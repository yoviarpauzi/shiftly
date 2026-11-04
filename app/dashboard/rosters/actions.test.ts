import { readFileSync } from "node:fs";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rosterRequest } from "@/database/schema/request-schema";
import {
  roster,
  rosterAssignment,
  rosterCellEdit,
  rosterConflict,
  rosterEdit,
  rosterShiftTarget,
} from "@/database/schema/roster-schema";
import type { RequestAccess } from "@/types/requests";
import type {
  AssignmentKind,
  CellContext,
  EvalCell,
  ReplacementContextResult,
  RosterEngineInput,
} from "@/types/rosters";
import type { EditCellInput, SwapCellInput } from "@/validation/rosters";
import {
  CELL_BUSY_MESSAGE,
  CELL_DATE_MESSAGE,
  CELL_OTHER_LINE_MESSAGE,
  CELL_SHIFT_MESSAGE,
  CELL_WORKS_THAT_DAY_MESSAGE,
  REPLACEMENT_WORKER_MISSING_MESSAGE,
  REQUEST_NOT_APPROVED_MESSAGE,
  ROSTER_CHANGED_MESSAGE,
  ROSTER_CONFIRMED_MESSAGE,
  ROSTER_EXISTS_MESSAGE,
  ROSTER_LINE_MISSING_MESSAGE,
  ROSTER_NOT_FOUND_MESSAGE,
  ROSTER_WORKER_MISSING_MESSAGE,
  TARGETS_MISMATCH_MESSAGE,
  targetsTotalMessage,
} from "./roster-rules";

// The database is replaced by a recorder, as in app/dashboard/requests/actions.test.ts. Every query
// is a Call, and a select's rows come from `fake.rows`, keyed by the table in `.from(...)`. The
// recorder cannot run a WHERE clause, so scope is simulated by the rows the test seeds. The row
// loaders in ./rosters are replaced, and the engine and checkReplacement run for real.
type Call = {
  op: "select" | "insert" | "update" | "delete" | "advisory";
  table?: unknown;
  values?: unknown;
  set?: Record<string, unknown>;
  lock?: string;
  where?: SQL;
  inTransaction: boolean;
};

const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  rows: {
    request: [] as Record<string, unknown>[],
    roster: [] as Record<string, unknown>[],
  },
  access: null as unknown,
  user: { id: "super-1", name: "Super" },
  engineInput: null as unknown,
  lines: [] as unknown[],
  context: null as unknown,
  candidates: [] as unknown[],
  insertError: null as unknown,
  cellContext: null as unknown,
  cellContextCalls: [] as unknown[],
  locationWorkers: [] as unknown[],
  locationWorkerCalls: [] as unknown[],
}));

const dialect = new PgDialect();

function whereParams(where: SQL | undefined): unknown[] {
  return where ? dialect.sqlToQuery(where).params : [];
}

function result(call: Call): unknown {
  if (call.op === "select") {
    if (call.table === rosterRequest) return fake.rows.request;
    if (call.table === roster) return fake.rows.roster;
    return [];
  }

  if (call.op === "insert" && call.table === roster) {
    if (fake.insertError) throw fake.insertError;
    return [{ id: "roster-new" }];
  }

  return [];
}

function builder(call: Call) {
  fake.calls.push(call);

  const chain = {
    from(table: unknown) {
      call.table = table;
      return chain;
    },
    innerJoin: () => chain,
    leftJoin: () => chain,
    where(where: SQL) {
      call.where = where;
      return chain;
    },
    returning: () => chain,
    for(strength: string) {
      call.lock = strength;
      return chain;
    },
    values(values: unknown) {
      call.values = values;
      return chain;
    },
    set(values: Record<string, unknown>) {
      call.set = values;
      return chain;
    },
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      return new Promise((done) => done(result(call))).then(resolve, reject);
    },
  };

  return chain;
}

function queries(inTransaction: boolean) {
  return {
    select: () => builder({ op: "select", inTransaction }),
    insert: (table: unknown) => builder({ op: "insert", table, inTransaction }),
    update: (table: unknown) => builder({ op: "update", table, inTransaction }),
    delete: (table: unknown) => builder({ op: "delete", table, inTransaction }),
    // The location lock: pg_advisory_xact_lock. Recorded with its SQL, so a test reads the id.
    execute: async (statement: SQL) => {
      fake.calls.push({ op: "advisory", where: statement, inTransaction });
      return [];
    },
  };
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./roster-guard", () => ({
  requireRosterUser: async () => ({ user: fake.user, access: fake.access }),
}));
vi.mock("./rosters", () => ({
  loadEngineInput: async () => ({ input: fake.engineInput, location: { id: "x", siteId: "y" } }),
  loadRequestLines: async () => fake.lines,
  loadReplacementContext: async () => fake.context,
  loadCellContext: async (_reader: unknown, input: unknown) => {
    fake.cellContextCalls.push(input);
    return fake.cellContext;
  },
  loadLocationWorkers: async (_reader: unknown, locationId: string) => {
    fake.locationWorkerCalls.push(locationId);
    return fake.locationWorkers;
  },
  replacementCandidates: async (...args: unknown[]) => {
    fake.candidates.push(args);
    return [{ workerId: "w9" }];
  },
}));
vi.mock("@/lib/db", () => ({
  db: {
    ...queries(false),
    transaction: async (run: (tx: unknown) => unknown) => run(queries(true)),
  },
}));

const { revalidatePath } = await import("next/cache");
const {
  confirmRoster,
  editRosterCell,
  generateRoster,
  listAddableWorkers,
  listCellCandidates,
  listReplacementCandidates,
  previewCellChange,
  replaceRosterWorker,
  swapRosterCellWorker,
} = await import("./actions");

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";
const REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ROSTER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LINE_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SHIFT_1 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SHIFT_2 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const POSITION_A = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const W1 = "10000000-0000-4000-8000-000000000001";
const W2 = "10000000-0000-4000-8000-000000000002";
const W3 = "10000000-0000-4000-8000-000000000003";
const DAY = "2026-11-09";
const VERSION = "2026-11-03T10:00:00.000Z";

type Role = { user: { id: string; name: string }; access: RequestAccess };

const superadmin: Role = {
  user: { id: "super-1", name: "Super" },
  access: { siteId: null, locationId: null },
};
const hoB: Role = {
  user: { id: "ho-b", name: "HO B" },
  access: { siteId: SITE_B, locationId: null },
};
const adminB: Role = {
  user: { id: "admin-b", name: "Admin B" },
  access: { siteId: SITE_A, locationId: LOCATION_B },
};

function actAs(role: Role) {
  fake.user = role.user;
  fake.access = role.access;
}

const worker = (id: string, employeeId: string) => ({
  id,
  employeeId,
  endContract: "2027-01-01",
  positionIds: [POSITION_A],
  workDaysPerWeek: null,
});

function engineInput(workers = [worker(W1, "E-1"), worker(W2, "E-2"), worker(W3, "E-3")]) {
  return {
    days: [DAY],
    lines: [{ id: LINE_A, positionId: POSITION_A }],
    shifts: [
      { id: SHIFT_1, order: 1 },
      { id: SHIFT_2, order: 2 },
    ],
    workers,
    rules: {
      workDaysPerWeek: 5,
      shiftExceptionDays: 7,
      requirePositionMatch: true,
      maxWorkingDaysPerMonth: 26,
    },
    history: [],
  } satisfies Omit<RosterEngineInput, "targets">;
}

const targets = (first = 1, second = 1) => [
  { lineId: LINE_A, date: DAY, shiftId: SHIFT_1, headcount: first },
  { lineId: LINE_A, date: DAY, shiftId: SHIFT_2, headcount: second },
];

const generateInput = (overrides: Record<string, unknown> = {}) => ({
  requestId: REQUEST_ID,
  targets: targets(),
  version: null,
  ...overrides,
});

const storedRequest = (overrides: Record<string, unknown> = {}) => ({
  id: REQUEST_ID,
  status: "approved",
  siteId: SITE_A,
  locationId: LOCATION_A,
  ...overrides,
});

const storedRoster = (overrides: Record<string, unknown> = {}) => ({
  id: ROSTER_ID,
  status: "draft",
  updatedAt: new Date(VERSION),
  siteId: SITE_A,
  locationId: LOCATION_A,
  ...overrides,
});

const writes = () => fake.calls.filter((call) => call.op !== "select" && call.op !== "advisory");
const advisoryLocks = () => fake.calls.filter((call) => call.op === "advisory");
// The selects that lock a row, in the order they ran.
const lockedSelects = () => fake.calls.filter((call) => call.op === "select" && call.lock);
const writesTo = (op: Call["op"], table: unknown) =>
  fake.calls.filter((call) => call.op === op && call.table === table);

beforeEach(() => {
  fake.calls = [];
  fake.rows = { request: [], roster: [] };
  fake.engineInput = engineInput();
  fake.lines = [
    { lineId: LINE_A, positionId: POSITION_A, positionName: "Operator", title: "Produksi / Operator", perDay: [2] },
  ];
  fake.context = null;
  fake.candidates = [];
  fake.insertError = null;
  fake.cellContext = null;
  fake.cellContextCalls = [];
  fake.locationWorkers = [];
  fake.locationWorkerCalls = [];
  actAs(superadmin);
  vi.mocked(revalidatePath).mockClear();
});

describe("roster actions module", () => {
  it("opens with the use server directive so client components can call it", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

    expect(source.split("\n")[0].trim()).toBe('"use server";');
  });
});

describe("generateRoster", () => {
  it("refuses invalid input and reads nothing", async () => {
    const res = await generateRoster({ requestId: "nope", targets: [], version: null });

    expect(res.ok).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  it("refuses a request that does not exist", async () => {
    expect(await generateRoster(generateInput())).toEqual({
      ok: false,
      formError: ROSTER_NOT_FOUND_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it("refuses a request in another location", async () => {
    actAs(adminB);
    fake.rows.request = [storedRequest()];

    expect(await generateRoster(generateInput())).toEqual({
      ok: false,
      formError: ROSTER_NOT_FOUND_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it("refuses a request that is not approved", async () => {
    fake.rows.request = [storedRequest({ status: "cancelled" })];

    expect(await generateRoster(generateInput())).toEqual({
      ok: false,
      formError: REQUEST_NOT_APPROVED_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it("refuses a day that does not add up and writes nothing", async () => {
    fake.rows.request = [storedRequest()];

    const res = await generateRoster(generateInput({ targets: targets(1, 0) }));

    expect(res).toEqual({
      ok: false,
      formError: targetsTotalMessage(DAY, 1, 2),
      fieldErrors: { [`${LINE_A}:${DAY}`]: targetsTotalMessage(DAY, 1, 2) },
    });
    expect(writes()).toEqual([]);
  });

  it("refuses a split that moves a fixed line to another shift and writes nothing", async () => {
    fake.rows.request = [storedRequest()];
    fake.lines = [
      {
        lineId: LINE_A,
        positionId: POSITION_A,
        positionName: "Operator",
        title: "Produksi / Operator",
        shiftId: SHIFT_1,
        shiftLabel: "Shift 1",
        perDay: [2],
      },
    ];

    const res = await generateRoster(generateInput({ targets: targets(1, 1) }));

    expect(res).toEqual({ ok: false, formError: TARGETS_MISMATCH_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("accepts a fixed line whose whole headcount is on its shift", async () => {
    fake.rows.request = [storedRequest()];
    fake.lines = [
      {
        lineId: LINE_A,
        positionId: POSITION_A,
        positionName: "Operator",
        title: "Produksi / Operator",
        shiftId: SHIFT_1,
        shiftLabel: "Shift 1",
        perDay: [2],
      },
    ];

    const res = await generateRoster(generateInput({ targets: targets(2, 0) }));

    expect(res.ok).toBe(true);
  });

  it("refuses a target for a shift or line the request does not have", async () => {
    fake.rows.request = [storedRequest()];
    const stray = "99999999-9999-4999-8999-999999999999";

    const res = await generateRoster(
      generateInput({ targets: [{ lineId: LINE_A, date: DAY, shiftId: stray, headcount: 2 }] }),
    );

    expect(res).toEqual({ ok: false, formError: TARGETS_MISMATCH_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("locks the request, then the location, then the roster", async () => {
    fake.rows.request = [storedRequest()];

    await generateRoster(generateInput());

    const [first, second, third] = fake.calls;

    expect([first.op, first.table, first.lock]).toEqual(["select", rosterRequest, "update"]);
    expect(second.op).toBe("advisory");
    expect(whereParams(second.where)).toEqual([LOCATION_A]);
    expect([third.op, third.table, third.lock]).toEqual(["select", roster, "update"]);
  });

  it("revalidates the roster's own page as well as the list", async () => {
    fake.rows.request = [storedRequest()];

    await generateRoster(generateInput());

    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/rosters");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/rosters/roster-new");
  });

  it("writes the roster, targets, assignments, and conflicts in one transaction", async () => {
    fake.rows.request = [storedRequest()];

    const res = await generateRoster(generateInput());

    expect(res).toEqual({ ok: true, rosterId: "roster-new" });
    expect(fake.calls.every((call) => call.inTransaction)).toBe(true);
    expect(writes().map((call) => [call.op, call.table])).toEqual([
      ["insert", roster],
      ["insert", rosterShiftTarget],
      ["insert", rosterAssignment],
    ]);
    expect(writesTo("insert", roster)[0].values).toEqual({
      requestId: REQUEST_ID,
      status: "draft",
      generatedBy: "super-1",
    });
    expect(writesTo("insert", rosterShiftTarget)[0].values).toEqual(
      targets().map((target) => ({
        rosterId: "roster-new",
        requestLineId: LINE_A,
        workDate: target.date,
        shiftId: target.shiftId,
        headcount: 1,
      })),
    );
    expect(writesTo("insert", rosterAssignment)[0].values).toEqual([
      {
        rosterId: "roster-new",
        requestLineId: LINE_A,
        workerId: W1,
        workDate: DAY,
        kind: "work",
        shiftId: SHIFT_1,
      },
      {
        rosterId: "roster-new",
        requestLineId: LINE_A,
        workerId: W2,
        workDate: DAY,
        kind: "work",
        shiftId: SHIFT_2,
      },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/rosters");
  });

  it("stores the shifts the rules could not fill as conflicts", async () => {
    fake.rows.request = [storedRequest()];
    fake.engineInput = engineInput([worker(W1, "E-1")]);

    const res = await generateRoster(generateInput());

    expect(res.ok).toBe(true);
    expect(writesTo("insert", rosterConflict)[0].values).toEqual([
      {
        rosterId: "roster-new",
        requestLineId: LINE_A,
        workDate: DAY,
        shiftId: SHIFT_2,
        code: "shortage",
        shortfall: 1,
        message: expect.stringContaining("Short by 1"),
      },
    ]);
  });

  it("replaces a draft's rows when the version is current, and clears its edits", async () => {
    fake.rows.request = [storedRequest()];
    fake.rows.roster = [storedRoster()];

    const res = await generateRoster(generateInput({ version: VERSION }));

    expect(res).toEqual({ ok: true, rosterId: ROSTER_ID });
    expect(writes().map((call) => [call.op, call.table])).toEqual([
      ["delete", rosterEdit],
      ["delete", rosterCellEdit],
      ["delete", rosterConflict],
      ["delete", rosterAssignment],
      ["delete", rosterShiftTarget],
      ["update", roster],
      ["insert", rosterShiftTarget],
      ["insert", rosterAssignment],
    ]);
    expect(writesTo("update", roster)[0].set).toEqual({
      generatedAt: expect.any(Date),
      generatedBy: "super-1",
    });
  });

  it("refuses a stale version", async () => {
    fake.rows.request = [storedRequest()];
    fake.rows.roster = [storedRoster()];

    expect(await generateRoster(generateInput({ version: "2026-11-03T09:00:00.000Z" }))).toEqual({
      ok: false,
      formError: ROSTER_CHANGED_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it("refuses a version for a roster that is gone", async () => {
    fake.rows.request = [storedRequest()];

    expect(await generateRoster(generateInput({ version: VERSION }))).toEqual({
      ok: false,
      formError: ROSTER_CHANGED_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it("tells a first generate that someone else got there first", async () => {
    fake.rows.request = [storedRequest()];
    fake.rows.roster = [storedRoster()];

    expect(await generateRoster(generateInput())).toEqual({
      ok: false,
      formError: ROSTER_EXISTS_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it("refuses a confirmed roster, even with a stale version", async () => {
    fake.rows.request = [storedRequest()];
    fake.rows.roster = [storedRoster({ status: "confirmed" })];

    expect(await generateRoster(generateInput({ version: "2020-01-01T00:00:00.000Z" }))).toEqual({
      ok: false,
      formError: ROSTER_CONFIRMED_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it("turns a unique violation on the request into the exists message and stops writing", async () => {
    fake.rows.request = [storedRequest()];
    fake.insertError = Object.assign(new Error("duplicate key"), { code: "23505" });

    expect(await generateRoster(generateInput())).toEqual({
      ok: false,
      formError: ROSTER_EXISTS_MESSAGE,
    });
    // The transaction throws out of the roster insert, so nothing after it runs.
    expect(writes().map((call) => [call.op, call.table])).toEqual([["insert", roster]]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("lets any other database error through", async () => {
    fake.rows.request = [storedRequest()];
    fake.insertError = new Error("connection lost");

    await expect(generateRoster(generateInput())).rejects.toThrow("connection lost");
  });
});

const replaceInput = (overrides: Record<string, unknown> = {}) => ({
  rosterId: ROSTER_ID,
  lineId: LINE_A,
  fromWorkerId: W1,
  toWorkerId: W2,
  version: VERSION,
  ...overrides,
});

function seedContext(overrides: Partial<ReplacementContextResult & { ok: true }> = {}) {
  fake.context = {
    ok: true,
    context: {
      row: [
        { date: "2026-11-09", kind: "work", shiftOrder: 1 },
        { date: "2026-11-10", kind: "off", shiftOrder: null },
      ],
      position: { id: POSITION_A, name: "Operator" },
      rules: {
        workDaysPerWeek: 5,
        shiftExceptionDays: 7,
        requirePositionMatch: true,
        maxWorkingDaysPerMonth: 26,
      },
      candidates: [
        {
          id: W2,
          employeeId: "E-2",
          name: "Two",
          endContract: "2027-01-01",
          positionIds: [POSITION_A],
          positionNames: ["Operator"],
          alreadyInRoster: false,
          otherRosterWorkDates: [],
          history: {
            workerId: W2,
            lastWorkDate: null,
            lastShiftOrder: null,
            consecutiveWorkDays: 0,
            monthWorkDays: {},
          },
        },
      ],
    },
    ...overrides,
  };
}

describe("replaceRosterWorker", () => {
  beforeEach(() => {
    fake.rows.request = [storedRequest()];
  });

  it("refuses a roster whose request is no longer approved, and writes nothing", async () => {
    fake.rows.request = [storedRequest({ status: "cancelled" })];
    fake.rows.roster = [storedRoster()];
    seedContext();

    expect(await replaceRosterWorker(replaceInput())).toEqual({
      ok: false,
      formError: REQUEST_NOT_APPROVED_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it("refuses invalid input and reads nothing", async () => {
    const res = await replaceRosterWorker(replaceInput({ toWorkerId: W1 }));

    expect(res.ok).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  it("moves every assignment of the line to the new worker and records the edit", async () => {
    fake.rows.roster = [storedRoster()];
    seedContext();

    const res = await replaceRosterWorker(replaceInput());

    expect(res).toEqual({ ok: true, warnings: [] });
    // The request, then the location, then the roster: the order generate takes them in.
    expect(lockedSelects().map((call) => call.table)).toEqual([rosterRequest, roster]);
    expect(advisoryLocks().map((call) => whereParams(call.where))).toEqual([[LOCATION_A]]);
    expect(fake.calls.every((call) => call.inTransaction)).toBe(true);
    expect(writes().map((call) => [call.op, call.table])).toEqual([
      ["update", rosterAssignment],
      ["insert", rosterEdit],
      ["update", roster],
    ]);

    const [move] = writesTo("update", rosterAssignment);

    expect(move.set).toEqual({ workerId: W2 });
    expect(whereParams(move.where)).toEqual([ROSTER_ID, LINE_A, W1]);
    expect(writesTo("insert", rosterEdit)[0].values).toEqual({
      rosterId: ROSTER_ID,
      requestLineId: LINE_A,
      fromWorkerId: W1,
      toWorkerId: W2,
      editedBy: "super-1",
    });
    expect(writesTo("update", roster)[0].set).toEqual({ updatedAt: expect.any(Date) });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/rosters");
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/rosters/${ROSTER_ID}`);
  });

  it.each([
    ["a roster that does not exist", [], ROSTER_NOT_FOUND_MESSAGE],
    ["a confirmed roster", [storedRoster({ status: "confirmed" })], ROSTER_CONFIRMED_MESSAGE],
  ])("refuses %s", async (_label, rows, message) => {
    fake.rows.roster = rows;
    seedContext();

    expect(await replaceRosterWorker(replaceInput())).toEqual({ ok: false, formError: message });
    expect(writes()).toEqual([]);
  });

  it("refuses a stale version", async () => {
    fake.rows.roster = [storedRoster()];
    seedContext();

    expect(await replaceRosterWorker(replaceInput({ version: "2026-11-03T09:00:00.000Z" }))).toEqual({
      ok: false,
      formError: ROSTER_CHANGED_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it.each([
    ["a line that is not in the roster", "line", ROSTER_LINE_MISSING_MESSAGE],
    ["a worker with no assignment on the line", "worker", ROSTER_WORKER_MISSING_MESSAGE],
  ] as const)("refuses %s", async (_label, reason, message) => {
    fake.rows.roster = [storedRoster()];
    fake.context = { ok: false, reason };

    expect(await replaceRosterWorker(replaceInput())).toEqual({ ok: false, formError: message });
    expect(writes()).toEqual([]);
  });

  it("refuses a worker who is not an active worker of the location", async () => {
    fake.rows.roster = [storedRoster()];
    seedContext();

    expect(await replaceRosterWorker(replaceInput({ toWorkerId: W3 }))).toEqual({
      ok: false,
      formError: REPLACEMENT_WORKER_MISSING_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it("saves a worker who only breaks rules, and returns the warnings", async () => {
    fake.rows.roster = [storedRoster()];
    seedContext();
    const loaded = fake.context as Extract<ReplacementContextResult, { ok: true }>;

    loaded.context.candidates[0] = { ...loaded.context.candidates[0], positionIds: [] };

    expect(await replaceRosterWorker(replaceInput())).toEqual({
      ok: true,
      warnings: ["Does not have the position Operator."],
    });
    expect(writesTo("update", rosterAssignment)).toHaveLength(1);
  });

  it("refuses a worker busy in another roster with the impossible reasons only", async () => {
    fake.rows.roster = [storedRoster()];
    seedContext();
    const loaded = fake.context as Extract<ReplacementContextResult, { ok: true }>;

    loaded.context.candidates[0] = {
      ...loaded.context.candidates[0],
      positionIds: [],
      otherRosterWorkDates: ["2026-11-09"],
    };

    expect(await replaceRosterWorker(replaceInput())).toEqual({
      ok: false,
      formError: "Assigned to another roster on Mon 9 Nov.",
    });
    expect(writes()).toEqual([]);
  });

  it("refuses a worker who is already in the roster", async () => {
    fake.rows.roster = [storedRoster()];
    seedContext();
    const loaded = fake.context as Extract<ReplacementContextResult, { ok: true }>;

    loaded.context.candidates[0] = { ...loaded.context.candidates[0], alreadyInRoster: true };

    expect(await replaceRosterWorker(replaceInput())).toEqual({
      ok: false,
      formError: "Already in this roster.",
    });
    expect(writes()).toEqual([]);
  });

  it.each([
    ["HO on another site", hoB],
    ["admin site on another location", adminB],
  ])("refuses %s as not found", async (_label, role) => {
    actAs(role);
    fake.rows.roster = [storedRoster()];
    seedContext();

    expect(await replaceRosterWorker(replaceInput())).toEqual({
      ok: false,
      formError: ROSTER_NOT_FOUND_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });
});

const confirmInput = (overrides: Record<string, unknown> = {}) => ({
  rosterId: ROSTER_ID,
  version: VERSION,
  ...overrides,
});

describe("confirmRoster", () => {
  beforeEach(() => {
    fake.rows.request = [storedRequest()];
  });

  it("refuses a roster whose request is no longer approved, and writes nothing", async () => {
    fake.rows.request = [storedRequest({ status: "cancelled" })];
    fake.rows.roster = [storedRoster()];

    expect(await confirmRoster(confirmInput())).toEqual({
      ok: false,
      formError: REQUEST_NOT_APPROVED_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it("confirms a draft with the time and the user", async () => {
    fake.rows.roster = [storedRoster()];

    const res = await confirmRoster(confirmInput());

    expect(res).toEqual({ ok: true });
    expect(lockedSelects().map((call) => call.table)).toEqual([rosterRequest, roster]);
    expect(advisoryLocks()).toEqual([]);
    expect(writes().map((call) => [call.op, call.table])).toEqual([["update", roster]]);
    expect(writes()[0].set).toEqual({
      status: "confirmed",
      confirmedAt: expect.any(Date),
      confirmedBy: "super-1",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/rosters");
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/rosters/${ROSTER_ID}`);
  });

  it("refuses a confirmed roster", async () => {
    fake.rows.roster = [storedRoster({ status: "confirmed" })];

    expect(await confirmRoster(confirmInput())).toEqual({
      ok: false,
      formError: ROSTER_CONFIRMED_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it("refuses a stale version", async () => {
    fake.rows.roster = [storedRoster()];

    expect(await confirmRoster(confirmInput({ version: "2026-11-03T09:00:00.000Z" }))).toEqual({
      ok: false,
      formError: ROSTER_CHANGED_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it("refuses a roster outside the actor's scope as not found", async () => {
    actAs(hoB);
    fake.rows.roster = [storedRoster()];

    expect(await confirmRoster(confirmInput())).toEqual({
      ok: false,
      formError: ROSTER_NOT_FOUND_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it("refuses invalid input and reads nothing", async () => {
    expect((await confirmRoster({ rosterId: "nope", version: "" })).ok).toBe(false);
    expect(fake.calls).toEqual([]);
  });
});

describe("listReplacementCandidates", () => {
  it("passes the actor's access and the ids to the query", async () => {
    actAs(hoB);

    const res = await listReplacementCandidates({ rosterId: ROSTER_ID, lineId: LINE_A, fromWorkerId: W1 });

    expect(res).toEqual([{ workerId: "w9" }]);
    expect(fake.candidates).toEqual([[{ siteId: SITE_B, locationId: null }, ROSTER_ID, LINE_A, W1]]);
  });

  it("gives nothing for ids that are not uuids, without a query", async () => {
    expect(
      await listReplacementCandidates({ rosterId: "x", lineId: LINE_A, fromWorkerId: W1 }),
    ).toEqual([]);
    expect(fake.candidates).toEqual([]);
  });
});

// ---- Cell edits. loadCellContext is replaced; the cell helpers and evaluateRoster run for real.

const LINE_B = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const STRAY_SHIFT = "99999999-9999-4999-8999-999999999999";
const NEXT_DAY = "2026-11-10";
const WEEK = [DAY, NEXT_DAY, "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];

function cell(
  workerId: string,
  date: string,
  kind: AssignmentKind = "work",
  shiftId: string | null = SHIFT_1,
  lineId = LINE_A,
): EvalCell {
  const working = kind === "work";

  return {
    lineId,
    workerId,
    date,
    kind,
    shiftId: working ? shiftId : null,
    shiftOrder: working ? (shiftId === SHIFT_2 ? 2 : 1) : null,
  };
}

const cellWorker = (id: string, employeeId: string, positionIds = [POSITION_A]) => ({
  id,
  employeeId,
  name: `Worker ${employeeId}`,
  endContract: "2027-01-01",
  positionIds,
  workDaysPerWeek: null,
  positionNames: positionIds.length > 0 ? ["Operator"] : [],
  active: true,
});

// W1 works shift 1 and W2 shift 2 on the first day, each shift needing one worker.
function seedCellContext(overrides: Partial<CellContext> = {}) {
  fake.cellContext = {
    ok: true,
    context: {
      dates: WEEK,
      shifts: [
        { id: SHIFT_1, order: 1 },
        { id: SHIFT_2, order: 2 },
      ],
      line: { id: LINE_A, positionId: POSITION_A, positionName: "Operator" },
      workers: [cellWorker(W1, "E-1")],
      cells: [cell(W1, DAY, "work", SHIFT_1), cell(W2, DAY, "work", SHIFT_2)],
      targets: [
        { lineId: LINE_A, date: DAY, shiftId: SHIFT_1, shiftOrder: 1, headcount: 1 },
        { lineId: LINE_A, date: DAY, shiftId: SHIFT_2, shiftOrder: 2, headcount: 1 },
      ],
      busy: [],
      history: [],
      rules: {
        workDaysPerWeek: 5,
        shiftExceptionDays: 7,
        requirePositionMatch: true,
        maxWorkingDaysPerMonth: 26,
      },
      previousConflicts: [],
      lines: [{ id: LINE_A, positionId: POSITION_A, positionName: "Operator" }],
      ...overrides,
    },
  };
}

const cellContext = () => (fake.cellContext as { context: CellContext }).context;

const editInput = (overrides: Partial<EditCellInput> = {}): EditCellInput => ({
  rosterId: ROSTER_ID,
  lineId: LINE_A,
  workerId: W1,
  date: DAY,
  to: { kind: "off" },
  version: VERSION,
  ...overrides,
});

// The roster-level refusals every edit action shares. Each writes nothing and loads no cells.
const rosterRefusals: [string, () => void, { version?: string }, string][] = [
  ["a roster that does not exist", () => (fake.rows.roster = []), {}, ROSTER_NOT_FOUND_MESSAGE],
  [
    "a confirmed roster",
    () => (fake.rows.roster = [storedRoster({ status: "confirmed" })]),
    {},
    ROSTER_CONFIRMED_MESSAGE,
  ],
  [
    "a roster whose request is no longer approved",
    () => (fake.rows.request = [storedRequest({ status: "cancelled" })]),
    {},
    REQUEST_NOT_APPROVED_MESSAGE,
  ],
  ["a stale version", () => {}, { version: "2026-11-03T09:00:00.000Z" }, ROSTER_CHANGED_MESSAGE],
  ["HO on another site", () => actAs(hoB), {}, ROSTER_NOT_FOUND_MESSAGE],
  ["admin site on another location", () => actAs(adminB), {}, ROSTER_NOT_FOUND_MESSAGE],
];

// The locked selects and the location lock, in the order they ran.
const lockOrder = () =>
  fake.calls
    .filter((call) => call.lock || call.op === "advisory")
    .map((call) => (call.op === "advisory" ? "advisory" : call.table));

describe("editRosterCell", () => {
  beforeEach(() => {
    fake.rows.request = [storedRequest()];
    fake.rows.roster = [storedRoster()];
    seedCellContext();
  });

  it("refuses invalid input and reads nothing", async () => {
    const res = await editRosterCell(editInput({ to: { kind: "work" } } as never));

    expect(res.ok).toBe(false);
    expect(fake.calls).toEqual([]);
    expect(fake.cellContextCalls).toEqual([]);
  });

  it("adds a row for a day the worker has no cell, and records the edit", async () => {
    const res = await editRosterCell(
      editInput({ date: NEXT_DAY, to: { kind: "work", shiftId: SHIFT_2 } }),
    );

    expect(res).toEqual({ ok: true, warnings: [] });
    expect(lockOrder()).toEqual([rosterRequest, "advisory", roster]);
    expect(advisoryLocks().map((call) => whereParams(call.where))).toEqual([[LOCATION_A]]);
    expect(fake.calls.every((call) => call.inTransaction)).toBe(true);
    expect(fake.cellContextCalls).toEqual([{ rosterId: ROSTER_ID, lineId: LINE_A, workerIds: [W1] }]);
    expect(writes().map((call) => [call.op, call.table])).toEqual([
      ["insert", rosterAssignment],
      ["insert", rosterCellEdit],
      ["delete", rosterConflict],
      ["update", roster],
    ]);
    expect(writesTo("insert", rosterAssignment)[0].values).toEqual({
      rosterId: ROSTER_ID,
      requestLineId: LINE_A,
      workerId: W1,
      workDate: NEXT_DAY,
      kind: "work",
      shiftId: SHIFT_2,
    });
    expect(writesTo("insert", rosterCellEdit)[0].values).toEqual({
      rosterId: ROSTER_ID,
      requestLineId: LINE_A,
      workerId: W1,
      workDate: NEXT_DAY,
      beforeKind: null,
      beforeShiftId: null,
      afterKind: "work",
      afterShiftId: SHIFT_2,
      editedBy: "super-1",
    });
    expect(whereParams(writesTo("delete", rosterConflict)[0].where)).toEqual([ROSTER_ID]);
    expect(writesTo("update", roster)[0].set).toEqual({ updatedAt: expect.any(Date) });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/rosters");
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/rosters/${ROSTER_ID}`);
  });

  it("changes the shift of a work cell, stores the shortage it leaves, and returns the warning", async () => {
    const res = await editRosterCell(editInput({ to: { kind: "work", shiftId: SHIFT_2 } }));

    expect(res).toEqual({ ok: true, warnings: ["Mon 9 Nov · Shift 2: 2 assigned, 1 needed."] });
    expect(writes().map((call) => [call.op, call.table])).toEqual([
      ["update", rosterAssignment],
      ["insert", rosterCellEdit],
      ["delete", rosterConflict],
      ["insert", rosterConflict],
      ["update", roster],
    ]);

    const [update] = writesTo("update", rosterAssignment);

    expect(update.set).toEqual({ kind: "work", shiftId: SHIFT_2 });
    expect(whereParams(update.where)).toEqual([ROSTER_ID, W1, DAY]);
    expect(writesTo("insert", rosterCellEdit)[0].values).toMatchObject({
      beforeKind: "work",
      beforeShiftId: SHIFT_1,
      afterKind: "work",
      afterShiftId: SHIFT_2,
    });
    expect(writesTo("insert", rosterConflict)[0].values).toEqual([
      {
        rosterId: ROSTER_ID,
        requestLineId: LINE_A,
        workDate: DAY,
        shiftId: SHIFT_1,
        code: "shortage",
        shortfall: 1,
        message: "Short by 1.",
      },
    ]);
  });

  it.each(["off", "break"] as const)("makes a work cell %s", async (kind) => {
    const res = await editRosterCell(editInput({ to: { kind } }));

    expect(res).toEqual({ ok: true, warnings: [] });

    const [update] = writesTo("update", rosterAssignment);

    expect(update.set).toEqual({ kind, shiftId: null });
    expect(whereParams(update.where)).toEqual([ROSTER_ID, W1, DAY]);
    expect(writesTo("insert", rosterCellEdit)[0].values).toMatchObject({
      beforeKind: "work",
      beforeShiftId: SHIFT_1,
      afterKind: kind,
      afterShiftId: null,
    });
    expect(writesTo("insert", rosterConflict)[0].values).toEqual([
      expect.objectContaining({ shiftId: SHIFT_1, shortfall: 1 }),
    ]);
  });

  it("deletes the row to clear a cell", async () => {
    const res = await editRosterCell(editInput({ to: { kind: "clear" } }));

    expect(res).toEqual({ ok: true, warnings: [] });
    expect(writes().map((call) => [call.op, call.table])).toEqual([
      ["delete", rosterAssignment],
      ["insert", rosterCellEdit],
      ["delete", rosterConflict],
      ["insert", rosterConflict],
      ["update", roster],
    ]);
    expect(whereParams(writesTo("delete", rosterAssignment)[0].where)).toEqual([ROSTER_ID, W1, DAY]);
    expect(writesTo("insert", rosterCellEdit)[0].values).toMatchObject({
      beforeKind: "work",
      beforeShiftId: SHIFT_1,
      afterKind: null,
      afterShiftId: null,
    });
  });

  it("clears a cell even when the worker works that day in another roster", async () => {
    cellContext().busy.push({ workerId: W1, date: DAY });

    expect(await editRosterCell(editInput({ to: { kind: "clear" } }))).toEqual({
      ok: true,
      warnings: [],
    });
    expect(writesTo("delete", rosterAssignment)).toHaveLength(1);
  });

  it("refuses to clear a cell that is in another line", async () => {
    cellContext().cells.push(cell(W1, NEXT_DAY, "off", null, LINE_B));

    expect(await editRosterCell(editInput({ date: NEXT_DAY, to: { kind: "clear" } }))).toEqual({
      ok: false,
      formError: CELL_OTHER_LINE_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it("keeps the engine's message for a shortage that did not change", async () => {
    seedCellContext({
      cells: [cell(W1, DAY, "work", SHIFT_1)],
      previousConflicts: [
        { lineId: LINE_A, date: DAY, shiftId: SHIFT_2, shortfall: 1, message: "No one is free." },
      ],
    });

    await editRosterCell(editInput({ date: NEXT_DAY, to: { kind: "off" } }));

    expect(writesTo("insert", rosterConflict)[0].values).toEqual([
      {
        rosterId: ROSTER_ID,
        requestLineId: LINE_A,
        workDate: DAY,
        shiftId: SHIFT_2,
        code: "shortage",
        shortfall: 1,
        message: "No one is free.",
      },
    ]);
  });

  it("lists only the warnings the edit introduced", async () => {
    // W1 lacks the position, which is warned already on the first work day.
    seedCellContext({ workers: [cellWorker(W1, "E-1", [])] });

    const res = await editRosterCell(
      editInput({ date: NEXT_DAY, to: { kind: "work", shiftId: SHIFT_1 } }),
    );

    expect(res).toEqual({ ok: true, warnings: [] });
  });

  it("saves an edit that breaks the weekly limit and returns the warning", async () => {
    seedCellContext({ cells: WEEK.slice(0, 5).map((date) => cell(W1, date)) });

    const res = await editRosterCell(
      editInput({ date: WEEK[5], to: { kind: "work", shiftId: SHIFT_1 } }),
    );

    expect(res).toEqual({ ok: true, warnings: ["Would exceed 5 working days this week."] });
    expect(writesTo("insert", rosterAssignment)).toHaveLength(1);
    expect(writesTo("insert", rosterCellEdit)).toHaveLength(1);
  });

  it("does not warn about the weekly rule for a worker whose own limit is 7 days", async () => {
    seedCellContext({
      workers: [{ ...cellWorker(W1, "E-1"), workDaysPerWeek: 7 }],
      cells: WEEK.slice(0, 5).map((date) => cell(W1, date)),
    });

    const res = await editRosterCell(
      editInput({ date: WEEK[5], to: { kind: "work", shiftId: SHIFT_1 } }),
    );

    expect(res).toEqual({ ok: true, warnings: [] });
    expect(writesTo("insert", rosterAssignment)).toHaveLength(1);
  });

  it("writes nothing for an edit that changes nothing", async () => {
    const res = await editRosterCell(editInput({ to: { kind: "work", shiftId: SHIFT_1 } }));

    expect(res).toEqual({ ok: true, warnings: [] });
    expect(writes()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["a day outside the roster", () => {}, { date: "2026-11-20" }, CELL_DATE_MESSAGE],
    [
      "a worker who is not active at the location",
      () => (fake.cellContext = { ok: false, reason: "worker" }),
      {},
      REPLACEMENT_WORKER_MISSING_MESSAGE,
    ],
    [
      "a line that is not in the roster",
      () => (fake.cellContext = { ok: false, reason: "line" }),
      {},
      ROSTER_LINE_MISSING_MESSAGE,
    ],
    [
      "a shift that is not active at the site",
      () => {},
      { to: { kind: "work", shiftId: STRAY_SHIFT } },
      CELL_SHIFT_MESSAGE,
    ],
    [
      "a worker with a row that day in another line",
      () => cellContext().cells.push(cell(W1, NEXT_DAY, "off", null, LINE_B)),
      { date: NEXT_DAY, to: { kind: "work", shiftId: SHIFT_1 } },
      CELL_OTHER_LINE_MESSAGE,
    ],
    [
      "a worker who works that day in another roster",
      () => cellContext().busy.push({ workerId: W1, date: NEXT_DAY }),
      { date: NEXT_DAY, to: { kind: "work", shiftId: SHIFT_1 } },
      CELL_BUSY_MESSAGE,
    ],
  ] as [string, () => void, Partial<EditCellInput>, string][])(
    "refuses %s and writes nothing",
    async (_label, setup, overrides, message) => {
      setup();

      expect(await editRosterCell(editInput(overrides))).toEqual({ ok: false, formError: message });
      expect(writes()).toEqual([]);
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );

  it.each(rosterRefusals)(
    "refuses %s, loads no cells, and writes nothing",
    async (_label, setup, overrides, message) => {
      setup();

      expect(await editRosterCell(editInput(overrides))).toEqual({ ok: false, formError: message });
      expect(fake.cellContextCalls).toEqual([]);
      expect(writes()).toEqual([]);
    },
  );
});

const swapInput = (overrides: Partial<SwapCellInput> = {}): SwapCellInput => ({
  rosterId: ROSTER_ID,
  lineId: LINE_A,
  date: DAY,
  fromWorkerId: W1,
  toWorkerId: W3,
  version: VERSION,
  ...overrides,
});

describe("swapRosterCellWorker", () => {
  beforeEach(() => {
    fake.rows.request = [storedRequest()];
    fake.rows.roster = [storedRoster()];
    seedCellContext({ workers: [cellWorker(W3, "E-3")] });
  });

  it("refuses invalid input and reads nothing", async () => {
    expect((await swapRosterCellWorker(swapInput({ toWorkerId: W1 }))).ok).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  it("moves the shift to the new worker and gives the old worker a day off, with two audit rows", async () => {
    const res = await swapRosterCellWorker(swapInput());

    expect(res).toEqual({ ok: true, warnings: [] });
    expect(lockOrder()).toEqual([rosterRequest, "advisory", roster]);
    expect(fake.calls.every((call) => call.inTransaction)).toBe(true);
    expect(fake.cellContextCalls).toEqual([{ rosterId: ROSTER_ID, lineId: LINE_A, workerIds: [W3] }]);
    expect(writes().map((call) => [call.op, call.table])).toEqual([
      ["update", rosterAssignment],
      ["insert", rosterCellEdit],
      ["insert", rosterAssignment],
      ["insert", rosterCellEdit],
      ["delete", rosterConflict],
      ["update", roster],
    ]);

    const [off] = writesTo("update", rosterAssignment);

    expect(off.set).toEqual({ kind: "off", shiftId: null });
    expect(whereParams(off.where)).toEqual([ROSTER_ID, W1, DAY]);
    expect(writesTo("insert", rosterAssignment)[0].values).toEqual({
      rosterId: ROSTER_ID,
      requestLineId: LINE_A,
      workerId: W3,
      workDate: DAY,
      kind: "work",
      shiftId: SHIFT_1,
    });
    expect(writesTo("insert", rosterCellEdit).map((call) => call.values)).toEqual([
      {
        rosterId: ROSTER_ID,
        requestLineId: LINE_A,
        workerId: W1,
        workDate: DAY,
        beforeKind: "work",
        beforeShiftId: SHIFT_1,
        afterKind: "off",
        afterShiftId: null,
        editedBy: "super-1",
      },
      {
        rosterId: ROSTER_ID,
        requestLineId: LINE_A,
        workerId: W3,
        workDate: DAY,
        beforeKind: null,
        beforeShiftId: null,
        afterKind: "work",
        afterShiftId: SHIFT_1,
        editedBy: "super-1",
      },
    ]);
    expect(writesTo("update", roster)[0].set).toEqual({ updatedAt: expect.any(Date) });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/rosters");
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/rosters/${ROSTER_ID}`);
  });

  it.each(["off", "break"] as const)("turns the new worker's %s cell into the work cell", async (kind) => {
    cellContext().cells.push(cell(W3, DAY, kind));

    expect(await swapRosterCellWorker(swapInput())).toEqual({ ok: true, warnings: [] });

    const [, onto] = writesTo("update", rosterAssignment);

    expect(onto.set).toEqual({ kind: "work", shiftId: SHIFT_1 });
    expect(whereParams(onto.where)).toEqual([ROSTER_ID, W3, DAY]);
    expect(writesTo("insert", rosterAssignment)).toEqual([]);
    expect(writesTo("insert", rosterCellEdit)[1].values).toMatchObject({
      beforeKind: kind,
      beforeShiftId: null,
      afterKind: "work",
      afterShiftId: SHIFT_1,
    });
  });

  it("returns the warnings the new worker brings and still saves", async () => {
    seedCellContext({ workers: [cellWorker(W3, "E-3", [])] });

    expect(await swapRosterCellWorker(swapInput())).toEqual({
      ok: true,
      warnings: ["Does not have the position Operator."],
    });
    expect(writesTo("insert", rosterCellEdit)).toHaveLength(2);
  });

  it("refuses to hand over a shift that is no longer active at the site", async () => {
    cellContext().shifts = [{ id: SHIFT_2, order: 2 }];

    expect(await swapRosterCellWorker(swapInput())).toEqual({
      ok: false,
      formError: CELL_SHIFT_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it("refuses a new worker who already works that day", async () => {
    seedCellContext({ workers: [cellWorker(W2, "E-2")] });

    expect(await swapRosterCellWorker(swapInput({ toWorkerId: W2 }))).toEqual({
      ok: false,
      formError: CELL_WORKS_THAT_DAY_MESSAGE,
    });
    expect(writes()).toEqual([]);
  });

  it.each([
    ["no cell", () => {}, { date: NEXT_DAY }],
    ["a day off", () => (cellContext().cells[0] = cell(W1, DAY, "off")), {}],
  ] as [string, () => void, Partial<SwapCellInput>][])(
    "refuses an old worker with %s on that date",
    async (_label, setup, overrides) => {
      setup();

      expect(await swapRosterCellWorker(swapInput(overrides))).toEqual({
        ok: false,
        formError: ROSTER_WORKER_MISSING_MESSAGE,
      });
      expect(writes()).toEqual([]);
    },
  );

  it.each([
    ["a day outside the roster", () => {}, { date: "2026-11-20" }, CELL_DATE_MESSAGE],
    [
      "a new worker who is not active at the location",
      () => (fake.cellContext = { ok: false, reason: "worker" }),
      {},
      REPLACEMENT_WORKER_MISSING_MESSAGE,
    ],
    [
      "a new worker with a row that day in another line",
      () => cellContext().cells.push(cell(W3, DAY, "off", null, LINE_B)),
      {},
      CELL_OTHER_LINE_MESSAGE,
    ],
    [
      "a new worker who works that day in another roster",
      () => cellContext().busy.push({ workerId: W3, date: DAY }),
      {},
      CELL_BUSY_MESSAGE,
    ],
  ] as [string, () => void, Partial<SwapCellInput>, string][])(
    "refuses %s and writes nothing",
    async (_label, setup, overrides, message) => {
      setup();

      expect(await swapRosterCellWorker(swapInput(overrides))).toEqual({
        ok: false,
        formError: message,
      });
      expect(writes()).toEqual([]);
    },
  );

  it.each(rosterRefusals)(
    "refuses %s, loads no cells, and writes nothing",
    async (_label, setup, overrides, message) => {
      setup();

      expect(await swapRosterCellWorker(swapInput(overrides))).toEqual({
        ok: false,
        formError: message,
      });
      expect(fake.cellContextCalls).toEqual([]);
      expect(writes()).toEqual([]);
    },
  );
});

const locationWorker = (id: string, employeeId: string, positionNames = ["Operator"]) => ({
  id,
  employeeId,
  name: `Worker ${employeeId}`,
  positionNames,
});

// The roster-level cases a read-only cell action answers with nothing.
const notVisible: [string, () => void][] = [
  ["a roster that does not exist", () => (fake.rows.roster = [])],
  ["HO on another site", () => actAs(hoB)],
  ["admin site on another location", () => actAs(adminB)],
];

describe("listCellCandidates", () => {
  const input = { rosterId: ROSTER_ID, lineId: LINE_A, date: DAY, fromWorkerId: W1 };

  beforeEach(() => {
    fake.rows.request = [storedRequest()];
    fake.rows.roster = [storedRoster()];
    fake.locationWorkers = [
      locationWorker(W1, "E-1"),
      locationWorker(W2, "E-2"),
      locationWorker(W3, "E-3", []),
    ];
    seedCellContext({ workers: [cellWorker(W2, "E-2"), cellWorker(W3, "E-3", [])] });
  });

  it("gives nothing for input that is not valid, without a query", async () => {
    expect(await listCellCandidates({ ...input, rosterId: "x" })).toEqual([]);
    expect(await listCellCandidates({ ...input, date: "x" })).toEqual([]);
    expect(fake.calls).toEqual([]);
    expect(fake.cellContextCalls).toEqual([]);
  });

  it.each(notVisible)("gives nothing for %s", async (_label, setup) => {
    setup();

    expect(await listCellCandidates(input)).toEqual([]);
    expect(fake.cellContextCalls).toEqual([]);
  });

  it("marks a worker who works that day as impossible and one who breaks a rule with the warning", async () => {
    const res = await listCellCandidates(input);

    expect(fake.locationWorkerCalls).toEqual([LOCATION_A]);
    expect(fake.cellContextCalls).toEqual([
      { rosterId: ROSTER_ID, lineId: LINE_A, workerIds: [W2, W3] },
    ]);
    expect(res).toEqual([
      {
        workerId: W2,
        employeeId: "E-2",
        name: "Worker E-2",
        positionNames: ["Operator"],
        hard: CELL_WORKS_THAT_DAY_MESSAGE,
        warnings: [],
        inRoster: true,
      },
      {
        workerId: W3,
        employeeId: "E-3",
        name: "Worker E-3",
        positionNames: [],
        hard: null,
        warnings: ["Does not have the position Operator."],
        inRoster: false,
      },
    ]);
    expect(writes()).toEqual([]);
  });
});

describe("listCellCandidates by cell state", () => {
  const input = { rosterId: ROSTER_ID, lineId: LINE_A, date: DAY, fromWorkerId: W1 };

  beforeEach(() => {
    fake.rows.request = [storedRequest()];
    fake.rows.roster = [storedRoster()];
    fake.locationWorkers = [locationWorker(W1, "E-1"), locationWorker(W2, "E-2"), locationWorker(W3, "E-3")];
  });

  it("allows a worker with an off cell, and refuses one busy elsewhere or in another line", async () => {
    seedCellContext({ workers: [cellWorker(W2, "E-2"), cellWorker(W3, "E-3")] });
    cellContext().cells = [cell(W1, DAY, "work", SHIFT_1), cell(W2, DAY, "off", null)];
    cellContext().busy.push({ workerId: W3, date: DAY });

    const res = await listCellCandidates(input);

    expect(res.map((entry) => [entry.workerId, entry.hard, entry.inRoster])).toEqual([
      [W2, null, true],
      [W3, CELL_BUSY_MESSAGE, false],
    ]);

    cellContext().busy = [];
    cellContext().cells.push(cell(W3, DAY, "break", null, LINE_B));

    expect((await listCellCandidates(input)).map((entry) => entry.hard)).toEqual([
      null,
      CELL_OTHER_LINE_MESSAGE,
    ]);
  });

  it("gives nothing when the line is not in the roster", async () => {
    fake.cellContext = { ok: false, reason: "line" };

    expect(await listCellCandidates(input)).toEqual([]);
  });
});

describe("listAddableWorkers", () => {
  beforeEach(() => {
    fake.rows.request = [storedRequest()];
    fake.rows.roster = [storedRoster()];
    fake.locationWorkers = [locationWorker(W1, "E-1"), locationWorker(W3, "E-3", [])];
  });

  it("gives nothing for ids that are not uuids, without a query", async () => {
    expect(await listAddableWorkers({ rosterId: ROSTER_ID, lineId: "x" })).toEqual([]);
    expect(fake.calls).toEqual([]);
    expect(fake.locationWorkerCalls).toEqual([]);
  });

  it.each(notVisible)("gives nothing for %s", async (_label, setup) => {
    setup();

    expect(await listAddableWorkers({ rosterId: ROSTER_ID, lineId: LINE_A })).toEqual([]);
    expect(fake.locationWorkerCalls).toEqual([]);
  });

  it("lists the active workers of the roster's location", async () => {
    expect(await listAddableWorkers({ rosterId: ROSTER_ID, lineId: LINE_A })).toEqual([
      { workerId: W1, employeeId: "E-1", name: "Worker E-1", positionNames: ["Operator"] },
      { workerId: W3, employeeId: "E-3", name: "Worker E-3", positionNames: [] },
    ]);
    expect(fake.locationWorkerCalls).toEqual([LOCATION_A]);
    expect(writes()).toEqual([]);
  });
});

describe("previewCellChange", () => {
  const base = {
    rosterId: ROSTER_ID,
    lineId: LINE_A,
    workerId: W1,
    date: DAY,
    to: { kind: "off" as const },
  };
  const nothing = { hard: ROSTER_NOT_FOUND_MESSAGE, warnings: [] };

  beforeEach(() => {
    fake.rows.request = [storedRequest()];
    fake.rows.roster = [storedRoster()];
    seedCellContext();
  });

  it("gives the not-found result for invalid input, without a query", async () => {
    expect(await previewCellChange({ ...base, workerId: "x" })).toEqual(nothing);
    expect(fake.calls).toEqual([]);
  });

  it.each(notVisible)("gives the not-found result for %s", async (_label, setup) => {
    setup();

    expect(await previewCellChange(base)).toEqual(nothing);
    expect(fake.cellContextCalls).toEqual([]);
  });

  it("gives the refusal editRosterCell would give, and writes nothing", async () => {
    cellContext().busy.push({ workerId: W1, date: NEXT_DAY });
    const change = { ...base, date: NEXT_DAY, to: { kind: "work" as const, shiftId: SHIFT_1 } };

    expect(await previewCellChange(change)).toEqual({ hard: CELL_BUSY_MESSAGE, warnings: [] });
    expect(writes()).toEqual([]);
    expect(await editRosterCell({ ...change, version: VERSION })).toEqual({
      ok: false,
      formError: CELL_BUSY_MESSAGE,
    });
  });

  it("gives a worker who is not active at the location as impossible", async () => {
    fake.cellContext = { ok: false, reason: "worker" };

    expect(await previewCellChange(base)).toEqual({
      hard: REPLACEMENT_WORKER_MISSING_MESSAGE,
      warnings: [],
    });
  });

  it("gives the warnings editRosterCell would return, and writes nothing", async () => {
    seedCellContext({ cells: WEEK.slice(0, 5).map((date) => cell(W1, date)) });
    const change = { ...base, date: WEEK[5], to: { kind: "work" as const, shiftId: SHIFT_1 } };

    const preview = await previewCellChange(change);

    expect(preview).toEqual({ hard: null, warnings: ["Would exceed 5 working days this week."] });
    expect(fake.calls.some((call) => call.inTransaction)).toBe(false);
    expect(writes()).toEqual([]);
    expect(await editRosterCell({ ...change, version: VERSION })).toEqual({
      ok: true,
      warnings: preview.warnings,
    });
  });
});
