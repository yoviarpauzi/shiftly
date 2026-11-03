import { readFileSync } from "node:fs";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rosterRequest } from "@/database/schema/request-schema";
import {
  roster,
  rosterAssignment,
  rosterConflict,
  rosterEdit,
  rosterShiftTarget,
} from "@/database/schema/roster-schema";
import type { RequestAccess } from "@/types/requests";
import type { ReplacementContextResult, RosterEngineInput } from "@/types/rosters";
import {
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
  op: "select" | "insert" | "update" | "delete";
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
const { confirmRoster, generateRoster, listReplacementCandidates, replaceRosterWorker } =
  await import("./actions");

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

const writes = () => fake.calls.filter((call) => call.op !== "select");
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

  it("refuses a target for a shift or line the request does not have", async () => {
    fake.rows.request = [storedRequest()];
    const stray = "99999999-9999-4999-8999-999999999999";

    const res = await generateRoster(
      generateInput({ targets: [{ lineId: LINE_A, date: DAY, shiftId: stray, headcount: 2 }] }),
    );

    expect(res).toEqual({ ok: false, formError: TARGETS_MISMATCH_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("locks the request row before it reads the roster", async () => {
    fake.rows.request = [storedRequest()];

    await generateRoster(generateInput());

    const [first, second] = fake.calls;

    expect([first.op, first.table, first.lock]).toEqual(["select", rosterRequest, "update"]);
    expect([second.op, second.table, second.lock]).toEqual(["select", roster, "update"]);
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
  it("refuses invalid input and reads nothing", async () => {
    const res = await replaceRosterWorker(replaceInput({ toWorkerId: W1 }));

    expect(res.ok).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  it("moves every assignment of the line to the new worker and records the edit", async () => {
    fake.rows.roster = [storedRoster()];
    seedContext();

    const res = await replaceRosterWorker(replaceInput());

    expect(res).toEqual({ ok: true });
    expect(fake.calls[0].lock).toBe("update");
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

  it("refuses a worker checkReplacement rejects, with every reason joined by a space", async () => {
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
      formError:
        "Does not have the position Operator. Assigned to another roster on Mon 9 Nov.",
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
  it("confirms a draft with the time and the user", async () => {
    fake.rows.roster = [storedRoster()];

    const res = await confirmRoster(confirmInput());

    expect(res).toEqual({ ok: true });
    expect(fake.calls[0].lock).toBe("update");
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
