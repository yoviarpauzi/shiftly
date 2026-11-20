import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { department } from "@/database/schema/department-schema";
import { location } from "@/database/schema/location-schema";
import { shift } from "@/database/schema/shift-schema";
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

const LOCATION_A = "33333333-3333-4333-8333-333333333331";
const LOCATION_B = "33333333-3333-4333-8333-333333333332";
const SHIFT_ID = "88888888-8888-4888-8888-888888888888";

const HO: AttendanceAccess = { userId: "user-1", role: "ho", locationId: null };
const ADMIN_A: AttendanceAccess = { userId: "user-2", role: "admin_site", locationId: LOCATION_A };

beforeEach(() => {
  fake.calls = [];
  fake.rows = new Map();
});

function seedChoices(locations: { id: string; name: string }[]) {
  fake.rows.set(
    location,
    locations.map((entry) => ({ ...entry, timezone: "Asia/Jakarta" })),
  );
  fake.rows.set(department, [{ id: "dep-1", name: "Packing" }]);
  fake.rows.set(shift, [{ id: SHIFT_ID, name: "Pagi" }]);
}

describe("attendanceChoicesFor", () => {
  it("reads the active shifts of the selected location", async () => {
    seedChoices([
      { id: LOCATION_A, name: "A" },
      { id: LOCATION_B, name: "B" },
    ]);

    const choices = await attendanceChoicesFor(HO, LOCATION_B);

    expect(choices.locationId).toBe(LOCATION_B);
    expect(choices.shifts).toEqual([{ id: SHIFT_ID, name: "Pagi" }]);

    const shiftRead = fake.calls.find((call) => call.table === shift);
    const params = dialect.sqlToQuery(shiftRead?.where as SQL).params;

    expect(params).toContain(LOCATION_B);
    expect(params).not.toContain(LOCATION_A);
  });

  it("offers no shifts and reads none when there is no location", async () => {
    seedChoices([]);

    const choices = await attendanceChoicesFor(HO, null);

    expect(choices.locationId).toBeNull();
    expect(choices.shifts).toEqual([]);
    expect(fake.calls.some((call) => call.table === shift)).toBe(false);
  });

  it("reads no departments or shifts while the location is All", async () => {
    seedChoices([
      { id: LOCATION_A, name: "A" },
      { id: LOCATION_B, name: "B" },
    ]);

    const choices = await attendanceChoicesFor(HO, null);

    expect(choices.locationId).toBeNull();
    expect(choices.departments).toEqual([]);
    expect(choices.shifts).toEqual([]);
    expect(fake.calls.some((call) => call.table === department)).toBe(false);
    expect(fake.calls.some((call) => call.table === shift)).toBe(false);
  });
});

describe("attendanceChoicesFor scope", () => {
  const locationRead = () => fake.calls.find((call) => call.table === location);
  const locationParams = () => dialect.sqlToQuery(locationRead()?.where as SQL).params;

  it("lists every location for HO, without a location filter", async () => {
    seedChoices([
      { id: LOCATION_A, name: "A" },
      { id: LOCATION_B, name: "B" },
    ]);

    const choices = await attendanceChoicesFor(HO, null);

    expect(choices.locations.map((entry) => entry.id)).toEqual([LOCATION_A, LOCATION_B]);
    expect(locationParams()).toEqual([]);
  });

  it("asks for the admin site's own location only", async () => {
    seedChoices([{ id: LOCATION_A, name: "A" }]);

    const choices = await attendanceChoicesFor(ADMIN_A, null);

    expect(locationParams()).toEqual([LOCATION_A]);
    expect(choices.locations.map((entry) => entry.id)).toEqual([LOCATION_A]);
    // One location, so it is chosen without being asked.
    expect(choices.locationId).toBe(LOCATION_A);
  });

  it("offers no site list and no site on the choices", async () => {
    seedChoices([{ id: LOCATION_A, name: "A" }]);

    const choices = await attendanceChoicesFor(HO, null);

    expect(choices).not.toHaveProperty("sites");
    expect(choices).not.toHaveProperty("siteId");
    expect(choices.locations[0]).not.toHaveProperty("siteId");
  });
});

describe("resolveSelection", () => {
  const two = [{ id: LOCATION_A }, { id: LOCATION_B }];

  it("is All when nothing is chosen and there is a choice", () => {
    expect(resolveSelection(two, null)).toBeNull();
  });

  it("picks the only location without being asked", () => {
    expect(resolveSelection([{ id: LOCATION_A }], null)).toBe(LOCATION_A);
  });

  it("keeps a chosen location", () => {
    expect(resolveSelection(two, LOCATION_B)).toBe(LOCATION_B);
  });

  it("falls back to All for a location that is not allowed", () => {
    expect(resolveSelection(two, "99999999-9999-4999-8999-999999999999")).toBeNull();
  });

  it("falls back to the only location when the asked one is not allowed", () => {
    expect(resolveSelection([{ id: LOCATION_A }], LOCATION_B)).toBe(LOCATION_A);
  });

  it("gives null when there are no locations", () => {
    expect(resolveSelection([], null)).toBeNull();
    expect(resolveSelection([], LOCATION_A)).toBeNull();
  });
});
