import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { roster, rosterAssignment } from "@/database/schema/roster-schema";
import { rosterRequest, rosterRequestLine, rosterRequestLineDay } from "@/database/schema/request-schema";
import { shift } from "@/database/schema/shift-schema";
import { worker, workerPosition } from "@/database/schema/worker-schema";
import { workRule } from "@/database/schema/work-rule-schema";
import type { Reader } from "@/types/rosters";
import type { WorkRuleRow } from "@/types/settings";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

const { loadCellContext, loadEngineInput, loadReplacementContext } = await import("./rosters");

const SITE_ID = "11111111-1111-4111-8111-111111111111";
const LOCATION_ID = "33333333-3333-4333-8333-333333333333";
const REQUEST_ID = "44444444-4444-4444-8444-444444444444";
const ROSTER_ID = "55555555-5555-4555-8555-555555555555";
const LINE_ID = "66666666-6666-4666-8666-666666666666";
const POSITION_ID = "77777777-7777-4777-8777-777777777777";
const SHIFT_ID = "88888888-8888-4888-8888-888888888888";
const W1 = "99999999-9999-4999-8999-999999999991";
const W2 = "99999999-9999-4999-8999-999999999992";
const W3 = "99999999-9999-4999-8999-999999999993";

const NOTHING_SET: WorkRuleRow = {
  workDaysPerWeek: null,
  breakDays: null,
  breakCycleMonths: null,
  annualOffDays: null,
  shiftExceptionDays: null,
  requirePositionMatch: null,
  keepPreviousPlacement: null,
  maxWorkingDaysPerMonth: null,
};

type Call = { table: unknown; columns: Record<string, unknown>; where?: SQL };

const dialect = new PgDialect();

// The database is replaced by a recorder. Each select is answered by the table in `.from(...)`,
// and the work_rule rows by the scope their WHERE asks for.
const fake = {
  calls: [] as Call[],
  rows: new Map<unknown, unknown[]>(),
  rules: { global: null, site: null, location: null } as Record<
    "global" | "site" | "location",
    WorkRuleRow | null
  >,
};

function answer(call: Call): unknown[] {
  if (call.table === workRule) {
    const scope = dialect.sqlToQuery(call.where as SQL).params[0] as keyof typeof fake.rules;
    const found = fake.rules[scope];

    return found ? [found] : [];
  }

  const rows = fake.rows.get(call.table) ?? [];

  // The roster's own assignments are the first read of that table; later reads are other rosters
  // and histories, which these tests leave empty.
  if (call.table === rosterAssignment) {
    const reads = fake.calls.filter((entry) => entry.table === rosterAssignment).length;

    return reads === 1 ? rows : [];
  }

  return rows;
}

const reader = {
  select: (columns: Record<string, unknown>) => {
    const call: Call = { table: undefined, columns };

    const chain = {
      from(table: unknown) {
        call.table = table;
        fake.calls.push(call);
        return chain;
      },
      innerJoin: () => chain,
      leftJoin: () => chain,
      where(condition: SQL) {
        call.where = condition;
        return chain;
      },
      orderBy: () => chain,
      then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
        return new Promise((done) => done(answer(call))).then(resolve, reject);
      },
    };

    return chain;
  },
} as unknown as Reader;

beforeEach(() => {
  fake.calls = [];
  fake.rows = new Map();
  fake.rules = { global: null, site: null, location: null };
});

function seedEngineInput() {
  fake.rows.set(rosterRequest, [
    { type: "weekly", startDate: "2026-11-09", siteId: SITE_ID, locationId: LOCATION_ID },
  ]);
  fake.rows.set(rosterRequestLine, [
    {
      lineId: LINE_ID,
      positionId: POSITION_ID,
      positionName: "Operator",
      departmentName: "Packing",
      subDepartmentName: null,
    },
  ]);
  fake.rows.set(rosterRequestLineDay, [{ lineId: LINE_ID, headcount: 1 }]);
  fake.rows.set(shift, [{ id: SHIFT_ID, order: 1 }]);
  fake.rows.set(worker, [
    { id: W1, employeeId: "E-1", endContract: "2027-01-01", workDaysPerWeek: 7 },
    { id: W2, employeeId: "E-2", endContract: "2027-01-01", workDaysPerWeek: 3 },
    { id: W3, employeeId: "E-3", endContract: "2027-01-01", workDaysPerWeek: null },
  ]);
  fake.rows.set(workerPosition, [{ workerId: W1, id: POSITION_ID, name: "Operator" }]);
}

describe("loadEngineInput", () => {
  it("gives the engine each worker's own working days, with null for a worker with none", async () => {
    seedEngineInput();

    const { input } = await loadEngineInput(reader, REQUEST_ID);

    expect(input.workers).toEqual([
      {
        id: W1,
        employeeId: "E-1",
        endContract: "2027-01-01",
        workDaysPerWeek: 7,
        positionIds: [POSITION_ID],
      },
      {
        id: W2,
        employeeId: "E-2",
        endContract: "2027-01-01",
        workDaysPerWeek: 3,
        positionIds: [],
      },
      {
        id: W3,
        employeeId: "E-3",
        endContract: "2027-01-01",
        workDaysPerWeek: null,
        positionIds: [],
      },
    ]);
  });

  it("selects the worker's own working days from the worker table", async () => {
    seedEngineInput();

    await loadEngineInput(reader, REQUEST_ID);

    const workerSelect = fake.calls.find((call) => call.table === worker);

    expect(workerSelect?.columns.workDaysPerWeek).toBe(worker.workDaysPerWeek);
  });

  it("uses the saved rules of the request's site and location instead of the defaults", async () => {
    seedEngineInput();
    fake.rules.global = { ...NOTHING_SET, maxWorkingDaysPerMonth: 24, requirePositionMatch: false };
    fake.rules.site = { ...NOTHING_SET, workDaysPerWeek: 7 };
    fake.rules.location = { ...NOTHING_SET, shiftExceptionDays: 2 };

    const { input } = await loadEngineInput(reader, REQUEST_ID);

    expect(input.rules).toEqual({
      workDaysPerWeek: 7,
      shiftExceptionDays: 2,
      requirePositionMatch: false,
      maxWorkingDaysPerMonth: 24,
    });

    const params = fake.calls
      .filter((call) => call.table === workRule)
      .map((call) => dialect.sqlToQuery(call.where as SQL).params);

    expect(params).toEqual([["global"], ["site", SITE_ID], ["location", LOCATION_ID]]);
  });

  it("reads the active shifts of the request's location, not its site", async () => {
    seedEngineInput();

    await loadEngineInput(reader, REQUEST_ID);

    const shiftSelect = fake.calls.find((call) => call.table === shift);
    const params = dialect.sqlToQuery(shiftSelect?.where as SQL).params;

    expect(params).toContain(LOCATION_ID);
    expect(params).not.toContain(SITE_ID);
  });

  it("keeps the defaults when no work rule is saved", async () => {
    seedEngineInput();

    const { input } = await loadEngineInput(reader, REQUEST_ID);

    expect(input.rules).toEqual({
      workDaysPerWeek: 5,
      shiftExceptionDays: 7,
      requirePositionMatch: true,
      maxWorkingDaysPerMonth: 26,
    });
  });
});

describe("loadReplacementContext", () => {
  function seedReplacement() {
    fake.rows.set(roster, [{ requestId: REQUEST_ID, siteId: SITE_ID, locationId: LOCATION_ID }]);
    fake.rows.set(rosterRequestLine, [{ positionId: POSITION_ID, positionName: "Operator" }]);
    fake.rows.set(rosterAssignment, [
      { workerId: W1, date: "2026-11-09", kind: "work", lineId: LINE_ID, shiftOrder: 1 },
    ]);
    fake.rows.set(worker, [
      { id: W2, employeeId: "E-2", name: "Two", endContract: "2027-01-01" },
    ]);
    fake.rows.set(workerPosition, [{ workerId: W2, id: POSITION_ID, name: "Operator" }]);
  }

  const replacement = {
    rosterId: ROSTER_ID,
    lineId: LINE_ID,
    fromWorkerId: W1,
    candidateIds: [W2],
  };

  it("selects the request's site with its location", async () => {
    seedReplacement();

    await loadReplacementContext(reader, replacement);

    const head = fake.calls.find((call) => call.table === roster);

    expect(head?.columns.siteId).toBe(rosterRequest.siteId);
    expect(head?.columns.locationId).toBe(rosterRequest.locationId);
  });

  it("checks a replacement against the saved rules of the roster's site and location", async () => {
    seedReplacement();
    fake.rules.site = { ...NOTHING_SET, requirePositionMatch: false };
    fake.rules.location = { ...NOTHING_SET, shiftExceptionDays: 3 };

    const loaded = await loadReplacementContext(reader, replacement);

    expect(loaded).toMatchObject({
      ok: true,
      context: {
        rules: {
          workDaysPerWeek: 5,
          shiftExceptionDays: 3,
          requirePositionMatch: false,
          maxWorkingDaysPerMonth: 26,
        },
      },
    });

    const params = fake.calls
      .filter((call) => call.table === workRule)
      .map((call) => dialect.sqlToQuery(call.where as SQL).params);

    expect(params).toEqual([["global"], ["site", SITE_ID], ["location", LOCATION_ID]]);
  });
});

// loadReplacementContext reads no shifts, so the shift read of a roster's cell menu is checked here.
describe("loadCellContext", () => {
  it("reads the active shifts of the request's location, not its site", async () => {
    fake.rows.set(roster, [
      {
        requestId: REQUEST_ID,
        type: "weekly",
        startDate: "2026-11-09",
        siteId: SITE_ID,
        locationId: LOCATION_ID,
      },
    ]);
    fake.rows.set(rosterRequestLine, [
      { lineId: LINE_ID, positionId: POSITION_ID, positionName: "Operator" },
    ]);
    fake.rows.set(shift, [{ id: SHIFT_ID, order: 1 }]);

    const loaded = await loadCellContext(reader, {
      rosterId: ROSTER_ID,
      lineId: LINE_ID,
      workerIds: [],
    });

    expect(loaded.ok).toBe(true);

    const shiftSelect = fake.calls.find((call) => call.table === shift);
    const params = dialect.sqlToQuery(shiftSelect?.where as SQL).params;

    expect(params).toContain(LOCATION_ID);
    expect(params).not.toContain(SITE_ID);
  });
});
