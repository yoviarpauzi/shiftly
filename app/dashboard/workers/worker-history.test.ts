import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerHistoryJoinedRow } from "@/types/worker-history";
import type { WorkerAccess } from "@/types/workers";

const dialect = new PgDialect();

const fake = vi.hoisted(() => ({
  wheres: [] as unknown[],
  // The rows of the first select, then of the replacement select. Each select takes the next list.
  rows: [] as unknown[],
  covers: [] as unknown[],
  calls: 0,
}));

// The database is replaced by a recorder. Each where is kept, and awaiting the chain gives `rows`,
// so the joins can be chained without being modelled.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: () => undefined }));
vi.mock("@/app/dashboard/rosters/roster-work-rules", () => ({ loadEngineRules: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => {
      const result = fake.calls === 0 ? fake.rows : fake.covers;
      fake.calls += 1;
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
        then: (resolve: (value: unknown[]) => unknown) => resolve(result),
      };

      return chain;
    },
  },
}));

const { loadWorkerMonth, workerHasHistory } = await import("./worker-history");

const WORKER = "99999999-9999-4999-8999-999999999999";
const LOCATION = "33333333-3333-4333-8333-333333333331";

const HO: WorkerAccess = { locationId: null };
const ADMIN_SITE: WorkerAccess = { locationId: LOCATION };

const BOUNDS = { from: "2026-11-01", to: "2026-11-12" };

const cover = {
  id: "sub-1",
  workerId: WORKER,
  date: "2026-11-11",
  shiftId: "s-1",
  shiftOrder: 1,
  shiftName: "Shift 1",
  startTime: "07:00:00",
  endTime: "15:00:00",
  departmentId: "d-1",
  departmentName: "Produksi",
  subDepartmentId: null,
  subDepartmentName: null,
  positionName: "Operator Produksi",
  rosterId: "r-1",
  poNumber: "PO-NK-202611-0003",
  absentWorkerName: "Budi Santoso",
};

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
  fake.covers = [];
  fake.calls = 0;
});

describe("loadWorkerMonth", () => {
  it("asks for the worker, the date range, a confirmed roster, and an approved request", async () => {
    await loadWorkerMonth(HO, WORKER, BOUNDS);

    const { params } = whereQuery();

    expect(params).toEqual(
      expect.arrayContaining([WORKER, BOUNDS.from, BOUNDS.to, "confirmed", "approved"]),
    );
  });

  it("adds no location condition for an HO", async () => {
    await loadWorkerMonth(HO, WORKER, BOUNDS);

    expect(whereQuery().params).not.toContain(LOCATION);
  });

  it("limits an admin site to its location", async () => {
    await loadWorkerMonth(ADMIN_SITE, WORKER, BOUNDS);

    expect(whereQuery().params).toContain(LOCATION);
  });

  it("keeps a department, sub-department, or shift that was deleted after the day", async () => {
    await loadWorkerMonth(HO, WORKER, BOUNDS);

    const text = whereQuery().sql;

    expect(text).not.toContain('"department"."deleted_at"');
    expect(text).not.toContain('"sub_department"."deleted_at"');
    expect(text).not.toContain('"shift"."deleted_at"');
  });

  it("returns the rows as history rows, with a work day without a record not marked", async () => {
    fake.rows = [joined];

    const [result] = await loadWorkerMonth(HO, WORKER, BOUNDS);

    expect(result.attendance).toBe("not-marked");
    expect(result.shift?.startTime).toBe("07:00");
  });
});

describe("loadWorkerMonth covers", () => {
  it("lists a day worked as a replacement once, present, with the absent worker's name", async () => {
    fake.covers = [cover];

    const result = await loadWorkerMonth(HO, WORKER, BOUNDS);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      assignmentId: "sub-1",
      date: "2026-11-11",
      kind: "work",
      attendance: "present",
      coveredFor: "Budi Santoso",
      poNumber: "PO-NK-202611-0003",
      rosterId: "r-1",
      shift: { id: "s-1", order: 1, startTime: "07:00", endTime: "15:00" },
    });
  });

  it("gives a worker with an own assignment on day 1 and a cover on day 2 two rows, by date", async () => {
    fake.rows = [{ ...joined, date: "2026-11-10" }];
    fake.covers = [cover];

    const result = await loadWorkerMonth(HO, WORKER, BOUNDS);

    expect(result.map((entry) => [entry.date, entry.coveredFor])).toEqual([
      ["2026-11-10", null],
      ["2026-11-11", "Budi Santoso"],
    ]);
  });

  it("orders a cover after an own row on the same date by shift order, then id", async () => {
    fake.rows = [{ ...joined, assignmentId: "z", date: "2026-11-11", shiftOrder: 2, shiftId: "s-2" }];
    fake.covers = [cover];

    const result = await loadWorkerMonth(HO, WORKER, BOUNDS);

    expect(result.map((entry) => entry.assignmentId)).toEqual(["sub-1", "z"]);
  });

  it("keeps the absent worker's own Absent day with no cover row", async () => {
    fake.rows = [{ ...joined, attendanceStatus: "absent" }];

    const result = await loadWorkerMonth(HO, WORKER, BOUNDS);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ attendance: "absent", coveredFor: null });
  });

  it("asks for the covers of the worker in the range, and limits an admin site to its location", async () => {
    await loadWorkerMonth(ADMIN_SITE, WORKER, BOUNDS);

    const { params } = dialect.sqlToQuery(fake.wheres[1] as SQL);

    expect(params).toEqual(
      expect.arrayContaining([WORKER, BOUNDS.from, BOUNDS.to, "confirmed", "approved", LOCATION]),
    );
  });

  it("adds no location condition to the covers of an HO", async () => {
    await loadWorkerMonth(HO, WORKER, BOUNDS);

    expect(dialect.sqlToQuery(fake.wheres[1] as SQL).params).not.toContain(LOCATION);
  });
});

describe("workerHasHistory", () => {
  it("is true for a worker whose only history is a cover on or before today", async () => {
    fake.covers = [{ id: "sub-1" }];

    expect(await workerHasHistory(HO, WORKER, "2026-11-12")).toBe(true);
    expect(dialect.sqlToQuery(fake.wheres[1] as SQL).params).toEqual(
      expect.arrayContaining([WORKER, "2026-11-12", "confirmed", "approved"]),
    );
  });

  it("limits the cover check of an admin site to its location", async () => {
    await workerHasHistory(ADMIN_SITE, WORKER, "2026-11-12");

    expect(dialect.sqlToQuery(fake.wheres[1] as SQL).params).toContain(LOCATION);
  });

  const TODAY = "2026-11-12";

  it("is true when the worker has a confirmed assignment", async () => {
    fake.rows = [{ id: "a-1" }];

    expect(await workerHasHistory(HO, WORKER, TODAY)).toBe(true);
    expect(whereQuery().params).toEqual(expect.arrayContaining([WORKER, "confirmed", "approved"]));
  });

  it("is false when the worker has none, as with a draft roster only", async () => {
    expect(await workerHasHistory(HO, WORKER, TODAY)).toBe(false);
  });

  it("only counts days up to today, so a roster that starts later is not history yet", async () => {
    await workerHasHistory(HO, WORKER, TODAY);

    expect(whereQuery().params).toContain(TODAY);
    expect(whereQuery().sql).toContain('"roster_assignment"."work_date" <=');
  });

  it("adds no location condition for an HO and limits an admin site to its location", async () => {
    await workerHasHistory(HO, WORKER, TODAY);
    expect(whereQuery().params).not.toContain(LOCATION);

    fake.wheres = [];
    await workerHasHistory(ADMIN_SITE, WORKER, TODAY);
    expect(whereQuery().params).toContain(LOCATION);
  });
});
