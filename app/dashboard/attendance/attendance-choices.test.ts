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

const { attendanceChoicesFor } = await import("./attendance");

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
});
