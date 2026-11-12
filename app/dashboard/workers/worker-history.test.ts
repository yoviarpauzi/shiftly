import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerHistoryJoinedRow } from "@/types/worker-history";
import type { WorkerAccess } from "@/types/workers";

const dialect = new PgDialect();

const fake = vi.hoisted(() => ({
  wheres: [] as unknown[],
  rows: [] as unknown[],
}));

// The database is replaced by a recorder. Each where is kept, and awaiting the chain gives `rows`,
// so the joins can be chained without being modelled.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: () => undefined }));
vi.mock("@/app/dashboard/rosters/roster-work-rules", () => ({ loadEngineRules: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => {
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: (condition: unknown) => {
          fake.wheres.push(condition);
          return chain;
        },
        orderBy: () => chain,
        limit: () => chain,
        then: (resolve: (value: unknown[]) => unknown) => resolve(fake.rows),
      };

      return chain;
    },
  },
}));

const { loadWorkerMonth, workerHasHistory } = await import("./worker-history");

const WORKER = "99999999-9999-4999-8999-999999999999";
const SITE = "11111111-1111-4111-8111-111111111111";
const LOCATION = "33333333-3333-4333-8333-333333333331";

const SUPERADMIN: WorkerAccess = { siteId: null, locationId: null };
const HO: WorkerAccess = { siteId: SITE, locationId: null };
const ADMIN_SITE: WorkerAccess = { siteId: SITE, locationId: LOCATION };

const BOUNDS = { from: "2026-11-01", to: "2026-11-12" };

const joined: WorkerHistoryJoinedRow = {
  assignmentId: "a-1",
  date: "2026-11-12",
  kind: "work",
  shiftId: "s-1",
  shiftOrder: 1,
  shiftName: "Shift 1",
  startTime: "07:00:00",
  endTime: "15:00:00",
  departmentId: "d-1",
  departmentName: "Produksi",
  subDepartmentName: null,
  positionName: "Operator Produksi",
  rosterId: "r-1",
  poNumber: "PO-NK-202611-0003",
  attendanceStatus: null,
};

function whereQuery() {
  return dialect.sqlToQuery(fake.wheres[0] as SQL);
}

beforeEach(() => {
  fake.wheres = [];
  fake.rows = [];
});

describe("loadWorkerMonth", () => {
  it("asks for the worker, the date range, a confirmed roster, and an approved request", async () => {
    await loadWorkerMonth(SUPERADMIN, WORKER, BOUNDS);

    const { params } = whereQuery();

    expect(params).toEqual(
      expect.arrayContaining([WORKER, BOUNDS.from, BOUNDS.to, "confirmed", "approved"]),
    );
  });

  it("adds no site or location condition for a superadmin", async () => {
    await loadWorkerMonth(SUPERADMIN, WORKER, BOUNDS);

    expect(whereQuery().params).not.toContain(SITE);
    expect(whereQuery().params).not.toContain(LOCATION);
  });

  it("limits an HO to its site", async () => {
    await loadWorkerMonth(HO, WORKER, BOUNDS);

    expect(whereQuery().params).toContain(SITE);
    expect(whereQuery().params).not.toContain(LOCATION);
  });

  it("limits an admin site to its site and location", async () => {
    await loadWorkerMonth(ADMIN_SITE, WORKER, BOUNDS);

    expect(whereQuery().params).toEqual(expect.arrayContaining([SITE, LOCATION]));
  });

  it("keeps a department, sub-department, or shift that was deleted after the day", async () => {
    await loadWorkerMonth(SUPERADMIN, WORKER, BOUNDS);

    const text = whereQuery().sql;

    expect(text).not.toContain('"department"."deleted_at"');
    expect(text).not.toContain('"sub_department"."deleted_at"');
    expect(text).not.toContain('"shift"."deleted_at"');
  });

  it("returns the rows as history rows, with a work day without a record not marked", async () => {
    fake.rows = [joined];

    const [result] = await loadWorkerMonth(SUPERADMIN, WORKER, BOUNDS);

    expect(result.attendance).toBe("not-marked");
    expect(result.shift?.startTime).toBe("07:00");
  });
});

describe("workerHasHistory", () => {
  it("is true when the worker has a confirmed assignment", async () => {
    fake.rows = [{ id: "a-1" }];

    expect(await workerHasHistory(SUPERADMIN, WORKER)).toBe(true);
    expect(whereQuery().params).toEqual(expect.arrayContaining([WORKER, "confirmed", "approved"]));
  });

  it("is false when the worker has none, as with a draft roster only", async () => {
    expect(await workerHasHistory(SUPERADMIN, WORKER)).toBe(false);
  });
});
