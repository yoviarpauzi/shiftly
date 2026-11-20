import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceAccess, AttendanceChoices, AttendanceFilters } from "@/types/attendance";

const dialect = new PgDialect();

const fake = vi.hoisted(() => ({
  selects: 0,
  wheres: [] as unknown[],
  rows: [] as unknown[],
}));

// The database is replaced by a recorder. A select counts, each where is kept, and awaiting the
// chain gives `rows`, so the joins can be chained without being modelled.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => {
      fake.selects += 1;

      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: (condition: unknown) => {
          fake.wheres.push(condition);
          return chain;
        },
        then: (resolve: (value: unknown[]) => unknown) => resolve(fake.rows),
      };

      return chain;
    },
  },
}));

const { listAttendance } = await import("./attendance");

const LOCATION_A = "33333333-3333-4333-8333-333333333331";
const LOCATION_B = "33333333-3333-4333-8333-333333333332";
const LOCATION_C = "33333333-3333-4333-8333-333333333333";
const DATE = "2026-11-09";

const HO: AttendanceAccess = { userId: "user-1", role: "ho", locationId: null };
const ADMIN_A: AttendanceAccess = { userId: "user-2", role: "admin_site", locationId: LOCATION_A };

const filters: AttendanceFilters = {
  date: DATE,
  locationId: null,
  departmentId: null,
  shiftId: null,
  status: "all",
  query: "",
};

function choicesFor(
  locations: AttendanceChoices["locations"],
  locationId: string | null = null,
): AttendanceChoices {
  return { locationId, locations, departments: [], shifts: [] };
}

const jakarta = (id: string) => ({ id, name: id, timezone: "Asia/Jakarta" as const });

beforeEach(() => {
  fake.selects = 0;
  fake.wheres = [];
  fake.rows = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("listAttendance", () => {
  it("reads nothing and returns an empty list when the scope is empty", async () => {
    const result = await listAttendance(HO, filters, choicesFor([]));

    expect(fake.selects).toBe(0);
    expect(result.rows).toEqual([]);
    expect(result.summary.scheduled).toBe(0);
  });

  const readLocations = async (access: AttendanceAccess) => {
    await listAttendance(
      access,
      filters,
      choicesFor([jakarta(LOCATION_A), jakarta(LOCATION_B), jakarta(LOCATION_C)]),
    );

    expect(fake.wheres).toHaveLength(1);

    return dialect.sqlToQuery(fake.wheres[0] as SQL).params;
  };

  it("reads every location for HO", async () => {
    const params = await readLocations(HO);

    expect(params).toContain(DATE);
    expect(params).toContain(LOCATION_A);
    expect(params).toContain(LOCATION_B);
    expect(params).toContain(LOCATION_C);
  });

  it("reads only its own location for admin site, even if the choices hold three", async () => {
    const params = await readLocations(ADMIN_A);

    expect(params).toContain(LOCATION_A);
    expect(params).not.toContain(LOCATION_B);
    expect(params).not.toContain(LOCATION_C);
  });

  it("reads nothing for admin site when the chosen location is another one", async () => {
    const result = await listAttendance(
      ADMIN_A,
      { ...filters, locationId: LOCATION_B },
      choicesFor([jakarta(LOCATION_A), jakarta(LOCATION_B)], LOCATION_B),
    );

    expect(fake.selects).toBe(0);
    expect(result.rows).toEqual([]);
  });

  it("uses the chosen location's time zone for today, and the default zone under All", async () => {
    // 23:30 on 9 Nov in Jakarta is already 10 Nov in Jayapura.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T16:30:00Z"));

    const papua = { id: LOCATION_B, name: "B", timezone: "Asia/Jayapura" as const };
    const locations = [jakarta(LOCATION_A), papua];

    const chosen = await listAttendance(HO, filters, choicesFor(locations, LOCATION_B));
    const all = await listAttendance(HO, filters, choicesFor(locations));

    expect(chosen.today).toBe("2026-11-10");
    expect(all.today).toBe("2026-11-09");
  });
});
