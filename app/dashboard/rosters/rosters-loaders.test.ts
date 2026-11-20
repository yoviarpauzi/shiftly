import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { roster, rosterAssignment } from "@/database/schema/roster-schema";
import { rosterRequest, rosterRequestLine, rosterRequestLineDay } from "@/database/schema/request-schema";
import { shift } from "@/database/schema/shift-schema";
import { worker, workerPosition } from "@/database/schema/worker-schema";
import type { EngineRules, Reader } from "@/types/rosters";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: { select: (...args: unknown[]) => (reader.select as (...a: unknown[]) => unknown)(...args) },
}));
// Reading the saved work rules belongs to roster-work-rules and its own test. Here the loaders are
// only checked for which location they ask the rules for and for passing the answer on.
vi.mock("./roster-work-rules", () => ({
  loadEngineRules: async (_reader: unknown, target: unknown) => {
    fake.rulesFor.push(target);

    return fake.engineRules;
  },
}));

const { getRoster, loadCellContext, loadEngineInput, loadReplacementContext } = await import(
  "./rosters"
);

const LOCATION_ID = "33333333-3333-4333-8333-333333333333";
const REQUEST_ID = "44444444-4444-4444-8444-444444444444";
const ROSTER_ID = "55555555-5555-4555-8555-555555555555";
const LINE_ID = "66666666-6666-4666-8666-666666666666";
const POSITION_ID = "77777777-7777-4777-8777-777777777777";
const SHIFT_ID = "88888888-8888-4888-8888-888888888888";
const DEPARTMENT_ID = "55555555-5555-4555-8555-555555555555";
const SUB_DEPARTMENT_ID = "66666666-6666-4666-8666-666666666666";
const W1 = "99999999-9999-4999-8999-999999999991";
const W2 = "99999999-9999-4999-8999-999999999992";
const W3 = "99999999-9999-4999-8999-999999999993";

const DEFAULT_RULES: EngineRules = {
  workDaysPerWeek: 5,
  shiftExceptionDays: 7,
  requirePositionMatch: true,
  keepPreviousPlacement: false,
  maxWorkingDaysPerMonth: 26,
};

type Call = { table: unknown; columns: Record<string, unknown>; where?: SQL };

const dialect = new PgDialect();

// The database is replaced by a recorder. Each select is answered by the table in `.from(...)`,
// and the work_rule rows by the scope their WHERE asks for.
const fake = {
  calls: [] as Call[],
  rows: new Map<unknown, unknown[]>(),
  // The targets loadEngineRules was called with, and what it answers.
  rulesFor: [] as unknown[],
  engineRules: DEFAULT_RULES,
};

function answer(call: Call): unknown[] {
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
  fake.rulesFor = [];
  fake.engineRules = DEFAULT_RULES;
});

function seedEngineInput() {
  fake.rows.set(rosterRequest, [
    { type: "weekly", startDate: "2026-11-09", locationId: LOCATION_ID },
  ]);
  fake.rows.set(rosterRequestLine, [
    {
      lineId: LINE_ID,
      positionId: POSITION_ID,
      positionName: "Operator",
      departmentId: DEPARTMENT_ID,
      departmentName: "Packing",
      subDepartmentId: SUB_DEPARTMENT_ID,
      subDepartmentName: "Line A",
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

  it("gives the engine each request line's department and sub-department", async () => {
    seedEngineInput();

    const { input } = await loadEngineInput(reader, REQUEST_ID);

    expect(input.lines).toEqual([
      {
        id: LINE_ID,
        positionId: POSITION_ID,
        departmentId: DEPARTMENT_ID,
        subDepartmentId: SUB_DEPARTMENT_ID,
      },
    ]);
  });

  it("selects the worker's own working days from the worker table", async () => {
    seedEngineInput();

    await loadEngineInput(reader, REQUEST_ID);

    const workerSelect = fake.calls.find((call) => call.table === worker);

    expect(workerSelect?.columns.workDaysPerWeek).toBe(worker.workDaysPerWeek);
  });

  it("asks for the work rules of the request's location only, and passes them to the engine", async () => {
    seedEngineInput();
    fake.engineRules = { ...DEFAULT_RULES, workDaysPerWeek: 7, maxWorkingDaysPerMonth: 24 };

    const { input } = await loadEngineInput(reader, REQUEST_ID);

    expect(input.rules).toEqual(fake.engineRules);
    expect(fake.rulesFor).toEqual([{ locationId: LOCATION_ID }]);
  });

  it("reads the active shifts of the request's location", async () => {
    seedEngineInput();

    await loadEngineInput(reader, REQUEST_ID);

    const shiftSelect = fake.calls.find((call) => call.table === shift);
    const params = dialect.sqlToQuery(shiftSelect?.where as SQL).params;

    expect(params).toContain(LOCATION_ID);
  });
});

describe("loadReplacementContext", () => {
  function seedReplacement() {
    fake.rows.set(roster, [{ requestId: REQUEST_ID, locationId: LOCATION_ID }]);
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

  it("selects the request's location, which no longer comes with a site", async () => {
    seedReplacement();

    await loadReplacementContext(reader, replacement);

    const head = fake.calls.find((call) => call.table === roster);

    expect(head?.columns.locationId).toBe(rosterRequest.locationId);
    expect(head?.columns).not.toHaveProperty("siteId");
  });

  it("checks a replacement against the work rules of the roster's location", async () => {
    seedReplacement();
    fake.engineRules = { ...DEFAULT_RULES, shiftExceptionDays: 3, requirePositionMatch: false };

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
    expect(fake.rulesFor).toEqual([{ locationId: LOCATION_ID }]);
  });
});

// loadReplacementContext reads no shifts, so the shift read of a roster's cell menu is checked here.
describe("loadCellContext", () => {
  it("reads the active shifts of the request's location", async () => {
    fake.rows.set(roster, [
      {
        requestId: REQUEST_ID,
        type: "weekly",
        startDate: "2026-11-09",
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
  });
});

// getRoster is what the detail page asks, so its WHERE is where the location scope lives.
describe("getRoster scope", () => {
  const headWhere = () => {
    const head = fake.calls.find((call) => call.table === roster);

    return dialect.sqlToQuery(head?.where as SQL).params;
  };

  it("limits admin site to the roster's request in its own location", async () => {
    expect(await getRoster({ locationId: LOCATION_ID }, ROSTER_ID)).toBeNull();

    expect(headWhere()).toEqual([ROSTER_ID, LOCATION_ID]);
  });

  it("adds no location limit for HO", async () => {
    expect(await getRoster({ locationId: null }, ROSTER_ID)).toBeNull();

    expect(headWhere()).toEqual([ROSTER_ID]);
  });

  it("reads nothing for an id that is not a uuid", async () => {
    expect(await getRoster({ locationId: null }, "nope")).toBeNull();

    expect(fake.calls).toEqual([]);
  });
});
