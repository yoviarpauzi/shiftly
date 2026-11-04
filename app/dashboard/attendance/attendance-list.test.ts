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

const SITE_1 = "11111111-1111-4111-8111-111111111111";
const SITE_2 = "22222222-2222-4222-8222-222222222222";
const LOCATION_A = "33333333-3333-4333-8333-333333333331";
const LOCATION_B = "33333333-3333-4333-8333-333333333332";
const LOCATION_C = "33333333-3333-4333-8333-333333333333";
const DATE = "2026-11-09";

const HO: AttendanceAccess = { userId: "user-1", role: "ho", siteId: SITE_1, locationId: null };
const SUPERADMIN: AttendanceAccess = {
  userId: "user-2",
  role: "superadmin",
  siteId: null,
  locationId: null,
};

const filters: AttendanceFilters = {
  date: DATE,
  siteId: null,
  locationId: null,
  departmentId: null,
  shiftId: null,
  status: "all",
  query: "",
};

function choicesFor(
  locations: AttendanceChoices["locations"],
  siteId: string | null = null,
  locationId: string | null = null,
): AttendanceChoices {
  return { siteId, locationId, sites: [], locations, departments: [], shifts: [] };
}

const jakarta = (id: string, siteId: string) => ({
  id,
  name: id,
  siteId,
  timezone: "Asia/Jakarta" as const,
});

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
    const result = await listAttendance(SUPERADMIN, filters, choicesFor([]));

    expect(fake.selects).toBe(0);
    expect(result.rows).toEqual([]);
    expect(result.summary.scheduled).toBe(0);
  });

  it("reads only the locations in the scope", async () => {
    const choices = choicesFor([
      jakarta(LOCATION_A, SITE_1),
      jakarta(LOCATION_B, SITE_1),
      jakarta(LOCATION_C, SITE_2),
    ]);

    await listAttendance(HO, filters, choices);

    expect(fake.wheres).toHaveLength(1);

    const params = dialect.sqlToQuery(fake.wheres[0] as SQL).params;

    expect(params).toContain(DATE);
    expect(params).toContain(LOCATION_A);
    expect(params).toContain(LOCATION_B);
    expect(params).not.toContain(LOCATION_C);
  });

  it("uses the chosen location's time zone for today, and the default zone under All", async () => {
    // 23:30 on 9 Nov in Jakarta is already 10 Nov in Jayapura.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T16:30:00Z"));

    const papua = { id: LOCATION_B, name: "B", siteId: SITE_1, timezone: "Asia/Jayapura" as const };
    const locations = [jakarta(LOCATION_A, SITE_1), papua];

    const chosen = await listAttendance(SUPERADMIN, filters, choicesFor(locations, SITE_1, LOCATION_B));
    const all = await listAttendance(SUPERADMIN, filters, choicesFor(locations));

    expect(chosen.today).toBe("2026-11-10");
    expect(all.today).toBe("2026-11-09");
  });
});
