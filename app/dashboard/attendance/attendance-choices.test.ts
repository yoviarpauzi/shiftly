import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { department } from "@/database/schema/department-schema";
import { location } from "@/database/schema/location-schema";
import { shift } from "@/database/schema/shift-schema";
import { site } from "@/database/schema/site-schema";
import type { AttendanceAccess } from "@/types/attendance";

const dialect = new PgDialect();

const fake = vi.hoisted(() => ({
  calls: [] as { table: unknown; where?: unknown }[],
  rows: new Map<unknown, unknown[]>(),
}));

// The database is replaced by a recorder. Each select is answered by the table in `.from(...)`.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => {
      const call: { table: unknown; where?: unknown } = { table: undefined };

      const chain = {
        from(table: unknown) {
          call.table = table;
          fake.calls.push(call);
          return chain;
        },
        where(condition: unknown) {
          call.where = condition;
          return chain;
        },
        orderBy: () => new Promise((done) => done(fake.rows.get(call.table) ?? [])),
      };

      return chain;
    },
  },
}));

const { attendanceChoicesFor, resolveSelection } = await import("./attendance");

const SITE_ID = "11111111-1111-4111-8111-111111111111";
const LOCATION_A = "33333333-3333-4333-8333-333333333331";
const LOCATION_B = "33333333-3333-4333-8333-333333333332";
const SHIFT_ID = "88888888-8888-4888-8888-888888888888";

const SUPERADMIN: AttendanceAccess = {
  userId: "user-1",
  role: "superadmin",
  siteId: null,
  locationId: null,
};

beforeEach(() => {
  fake.calls = [];
  fake.rows = new Map();
});

function seedChoices(locations: { id: string; name: string }[]) {
  fake.rows.set(site, [{ id: SITE_ID, name: "Site" }]);
  fake.rows.set(
    location,
    locations.map((entry) => ({ ...entry, siteId: SITE_ID, timezone: "Asia/Jakarta" })),
  );
  fake.rows.set(department, [{ id: "dep-1", name: "Packing" }]);
  fake.rows.set(shift, [{ id: SHIFT_ID, name: "Pagi" }]);
}

describe("attendanceChoicesFor", () => {
  it("reads the active shifts of the selected location, not of its site", async () => {
    seedChoices([
      { id: LOCATION_A, name: "A" },
      { id: LOCATION_B, name: "B" },
    ]);

    const choices = await attendanceChoicesFor(SUPERADMIN, SITE_ID, LOCATION_B);

    expect(choices.locationId).toBe(LOCATION_B);
    expect(choices.shifts).toEqual([{ id: SHIFT_ID, name: "Pagi" }]);

    const shiftRead = fake.calls.find((call) => call.table === shift);
    const params = dialect.sqlToQuery(shiftRead?.where as SQL).params;

    expect(params).toContain(LOCATION_B);
    expect(params).not.toContain(LOCATION_A);
    expect(params).not.toContain(SITE_ID);
  });

  it("offers no shifts and reads none when the site has no location", async () => {
    seedChoices([]);

    const choices = await attendanceChoicesFor(SUPERADMIN, SITE_ID, null);

    expect(choices.locationId).toBeNull();
    expect(choices.shifts).toEqual([]);
    expect(fake.calls.some((call) => call.table === shift)).toBe(false);
  });

  it("reads no departments or shifts while the location is All", async () => {
    seedChoices([
      { id: LOCATION_A, name: "A" },
      { id: LOCATION_B, name: "B" },
    ]);

    const choices = await attendanceChoicesFor(SUPERADMIN, SITE_ID, null);

    expect(choices.locationId).toBeNull();
    expect(choices.departments).toEqual([]);
    expect(choices.shifts).toEqual([]);
    expect(fake.calls.some((call) => call.table === department)).toBe(false);
    expect(fake.calls.some((call) => call.table === shift)).toBe(false);
  });
});

const SITE_B = "11111111-1111-4111-8111-111111111112";
const LOCATION_OF_B = "33333333-3333-4333-8333-333333333333";

describe("resolveSelection", () => {
  const twoSites = [{ id: SITE_ID }, { id: SITE_B }];
  const locations = [
    { id: LOCATION_A, siteId: SITE_ID },
    { id: LOCATION_B, siteId: SITE_ID },
    { id: LOCATION_OF_B, siteId: SITE_B },
  ];

  it("is All sites and All locations when nothing is chosen and there is a choice", () => {
    expect(resolveSelection(twoSites, locations, null, null)).toEqual({
      siteId: null,
      locationId: null,
    });
  });

  it("picks the only site and the only location without being asked", () => {
    expect(
      resolveSelection([{ id: SITE_ID }], [{ id: LOCATION_A, siteId: SITE_ID }], null, null),
    ).toEqual({ siteId: SITE_ID, locationId: LOCATION_A });
  });

  it("picks the only site but stays on All locations when it has two", () => {
    expect(resolveSelection([{ id: SITE_ID }], locations.slice(0, 2), null, null)).toEqual({
      siteId: SITE_ID,
      locationId: null,
    });
  });

  it("keeps a chosen site and location", () => {
    expect(resolveSelection(twoSites, locations, SITE_ID, LOCATION_B)).toEqual({
      siteId: SITE_ID,
      locationId: LOCATION_B,
    });
  });

  it("falls back to All for a site that is not allowed", () => {
    expect(
      resolveSelection(twoSites, locations, "99999999-9999-4999-8999-999999999999", LOCATION_A),
    ).toEqual({ siteId: null, locationId: null });
  });

  it("falls back to All locations for a location of another site", () => {
    expect(resolveSelection(twoSites, locations, SITE_ID, LOCATION_OF_B)).toEqual({
      siteId: SITE_ID,
      locationId: null,
    });
  });

  it("ignores a location when no site is chosen", () => {
    expect(resolveSelection(twoSites, locations, null, LOCATION_A)).toEqual({
      siteId: null,
      locationId: null,
    });
  });

  it("gives null for both when there are no sites", () => {
    expect(resolveSelection([], [], null, null)).toEqual({ siteId: null, locationId: null });
  });
});
