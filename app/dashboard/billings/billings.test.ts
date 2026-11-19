import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { BillingAccess } from "@/types/billings";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

const {
  ATTENDANCE_PRESENT,
  ASSIGNMENT_WORK,
  ROSTER_CONFIRMED,
  billableDayConditions,
  billingScopeFilter,
} = await import("./billings");

const dialect = new PgDialect();

function render(condition: SQL | undefined) {
  return condition ? dialect.sqlToQuery(condition) : { sql: "", params: [] };
}

const SITE = "11111111-1111-4111-8111-111111111111";
const LOC = "22222222-2222-4222-8222-222222222222";

function access(siteId: string | null, locationId: string | null): BillingAccess {
  return { siteId, locationId };
}

describe("billingScopeFilter", () => {
  it("has no filter for a superadmin", () => {
    expect(billingScopeFilter(access(null, null))).toBeUndefined();
  });

  it("limits an HO to its site only", () => {
    const { sql, params } = render(billingScopeFilter(access(SITE, null)));

    expect(params).toEqual([SITE]);
    expect(sql).toContain('"site_id"');
    expect(sql).not.toContain('"location_id"');
  });

  it("limits an admin site to its location only", () => {
    const { sql, params } = render(billingScopeFilter(access(SITE, LOC)));

    expect(params).toEqual([LOC]);
    expect(sql).toContain('"location_id"');
    expect(sql).not.toContain('"site_id"');
  });
});

describe("billableDayConditions", () => {
  const { sql, params } = render(billableDayConditions(LOC, { from: "2026-11-01", to: "2026-11-30" }));

  it("binds the location, the inclusive period and the three status literals", () => {
    expect(params).toEqual(
      expect.arrayContaining([
        LOC,
        "2026-11-01",
        "2026-11-30",
        ATTENDANCE_PRESENT,
        ASSIGNMENT_WORK,
        ROSTER_CONFIRMED,
      ]),
    );
    expect([ATTENDANCE_PRESENT, ASSIGNMENT_WORK, ROSTER_CONFIRMED]).toEqual([
      "present",
      "work",
      "confirmed",
    ]);
  });

  it("leaves out the days another billing holds, with not exists", () => {
    expect(sql).toContain("not exists");
  });

  it("does not filter on deleted_at or on the request status", () => {
    expect(sql).not.toContain("deleted_at");
    expect(sql).not.toContain("approved");
  });
});
