import { readFileSync } from "node:fs";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attendance, attendanceSubstitute } from "@/database/schema/attendance-schema";
import { rosterRequest } from "@/database/schema/request-schema";
import { roster, rosterAssignment } from "@/database/schema/roster-schema";
import type {
  AttendanceAccess,
  SubstituteCandidateContext,
  SubstituteTarget,
} from "@/types/attendance";
import type { EngineHistory, EngineRules } from "@/types/rosters";
import {
  ATTENDANCE_NOT_FOUND_MESSAGE,
  FUTURE_DAY_MESSAGE,
  NOT_SCHEDULED_MESSAGE,
} from "./attendance-rules";
import {
  NEEDS_ABSENT_MESSAGE,
  SUBSTITUTE_COVERS_MESSAGE,
  SUBSTITUTE_MESSAGES,
} from "./attendance-substitute-rules";

// The database is replaced by a recorder, as in app/dashboard/workers/actions.test.ts. Every query
// is a Call. The one select returns `fake.rows.assignments`, which stands for the assignments the
// save asked for, already joined to their roster, request, and location. The recorder cannot run a
// WHERE clause, so scope is simulated by which rows the test seeds.
type Call = {
  op: "select" | "insert" | "delete";
  table?: unknown;
  values?: unknown;
  conflict?: { target: unknown; set: Record<string, unknown> };
  lock?: { strength: string; of?: unknown };
  where?: SQL;
  inTransaction: boolean;
  // Which db.transaction call it ran in, counted from 1, or null outside one.
  transaction: number | null;
};

// target and candidates stand for what loadSubstituteTarget and loadSubstituteCandidates read, so
// the set and list actions are tested on their own decisions. failOn makes the first query of that
// kind reject with failWith, the way a unique index does inside a transaction.
const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  rows: { assignments: [] as Record<string, unknown>[] },
  access: null as unknown,
  transactions: 0,
  target: null as unknown,
  candidates: [] as unknown[],
  rules: null as unknown,
  failOn: null as "insert" | "delete" | null,
  failWith: null as unknown,
  loadTarget: vi.fn(),
  loadCandidates: vi.fn(),
  loadRules: vi.fn(),
}));

const dialect = new PgDialect();

function whereParams(where: SQL | undefined): unknown[] {
  return where ? dialect.sqlToQuery(where).params : [];
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
    for(strength: string, config?: { of?: unknown }) {
      call.lock = { strength, of: config?.of };
      return chain;
    },
    values(values: unknown) {
      call.values = values;
      return chain;
    },
    onConflictDoUpdate(config: { target: unknown; set: Record<string, unknown> }) {
      call.conflict = config;
      return chain;
    },
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      // The one select asks for assignments by id, so only those come back, as the database would.
      if (fake.failOn === call.op) {
        return new Promise((_, fail) => fail(fake.failWith)).then(resolve, reject);
      }

      const asked = whereParams(call.where);
      const rows =
        call.op === "select"
          ? fake.rows.assignments.filter((row) => asked.includes(row.id))
          : [];

      return new Promise((done) => done(rows)).then(resolve, reject);
    },
  };

  return chain;
}

function queries(inTransaction: boolean, transaction: number | null = null) {
  return {
    inTransaction,
    select: () => builder({ op: "select", inTransaction, transaction }),
    insert: (table: unknown) => builder({ op: "insert", table, inTransaction, transaction }),
    delete: (table: unknown) => builder({ op: "delete", table, inTransaction, transaction }),
  };
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./attendance-guard", () => ({
  requireAttendanceAccess: async () => fake.access,
}));
vi.mock("@/lib/db", () => ({
  db: {
    ...queries(false),
    transaction: async (run: (tx: unknown) => unknown) => {
      fake.transactions += 1;

      return run(queries(true, fake.transactions));
    },
  },
}));
vi.mock("./attendance-substitute", () => ({
  loadSubstituteTarget: (...args: unknown[]) => fake.loadTarget(...args),
  loadSubstituteCandidates: (...args: unknown[]) => fake.loadCandidates(...args),
}));
vi.mock("../rosters/roster-work-rules", () => ({
  loadEngineRules: (...args: unknown[]) => fake.loadRules(...args),
}));

const { revalidatePath } = await import("next/cache");
const { listSubstituteCandidates, saveAttendance, setSubstitute } = await import("./actions");

const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_A2 = "44444444-4444-4444-8444-444444444444";
const ASSIGNMENT_1 = "a0000000-0000-4000-8000-000000000001";
const ASSIGNMENT_2 = "a0000000-0000-4000-8000-000000000002";
const MISSING = "a0000000-0000-4000-8000-0000000000ff";
const DATE = "2026-11-09";

const access = (overrides: Partial<AttendanceAccess>): AttendanceAccess => ({
  userId: "user-1",
  role: "ho",
  locationId: null,
  ...overrides,
});

const ho = access({});
const adminA = access({ userId: "admin-a", role: "admin_site", locationId: LOCATION_A });
const adminOther = access({ userId: "admin-o", role: "admin_site", locationId: LOCATION_A2 });

const stored = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  kind: "work",
  workDate: DATE,
  rosterStatus: "confirmed",
  requestStatus: "approved",
  locationId: LOCATION_A,
  timezone: "Asia/Jakarta",
  ...overrides,
});

const entry = (assignmentId: string, status: string | null, reason: string | null = null) => ({
  assignmentId,
  status,
  reason,
});

const input = (entries: unknown[], date = DATE) => ({ date, entries }) as never;

const writes = () => fake.calls.filter((call) => call.op !== "select");

const ATTENDANCE_1 = "b0000000-0000-4000-8000-000000000001";
const WORKER_ABSENT = "c0000000-0000-4000-8000-000000000001";
const WORKER_COVER = "c0000000-0000-4000-8000-000000000002";
const WORKER_OTHER = "c0000000-0000-4000-8000-000000000003";
const WORKER_ELSEWHERE = "c0000000-0000-4000-8000-0000000000ee";
const POSITION = "d0000000-0000-4000-8000-000000000001";

const RULES: EngineRules = {
  workDaysPerWeek: 5,
  shiftExceptionDays: 0,
  requirePositionMatch: true,
  keepPreviousPlacement: false,
  maxWorkingDaysPerMonth: 25,
};

const NO_HISTORY: EngineHistory = {
  workerId: WORKER_COVER,
  lastWorkDate: null,
  lastShiftOrder: null,
  consecutiveWorkDays: 0,
  monthWorkDays: {},
  lastPlacement: null,
};

const target = (overrides: Partial<SubstituteTarget> = {}): SubstituteTarget => ({
  assignmentId: ASSIGNMENT_1,
  attendanceId: ATTENDANCE_1,
  status: "absent",
  workerId: WORKER_ABSENT,
  date: DATE,
  locationId: LOCATION_A,
  timezone: "Asia/Jakarta",
  rosterStatus: "confirmed",
  requestStatus: "approved",
  kind: "work",
  shiftOrder: 1,
  position: { id: POSITION, name: "Cook" },
  departmentId: "e0000000-0000-4000-8000-000000000001",
  subDepartmentId: null,
  ...overrides,
});

const candidate = (
  id: string,
  overrides: Partial<SubstituteCandidateContext> = {},
): SubstituteCandidateContext => ({
  id,
  employeeId: `E-${id.slice(-2)}`,
  name: `Worker ${id.slice(-2)}`,
  positionIds: [POSITION],
  positionNames: ["Cook"],
  endContract: "2027-12-31",
  deleted: false,
  locationId: LOCATION_A,
  workDatesToday: false,
  alreadyCovering: false,
  history: { ...NO_HISTORY, workerId: id },
  ...overrides,
});

const pick = (substituteWorkerId: string | null, assignmentId = ASSIGNMENT_1) =>
  ({ assignmentId, substituteWorkerId }) as never;

beforeEach(() => {
  fake.calls = [];
  fake.transactions = 0;
  fake.failOn = null;
  fake.failWith = null;
  fake.rows = { assignments: [stored(ASSIGNMENT_1), stored(ASSIGNMENT_2)] };
  fake.access = ho;
  fake.target = target();
  fake.candidates = [candidate(WORKER_COVER)];
  fake.rules = RULES;
  fake.loadTarget.mockReset();
  fake.loadTarget.mockImplementation(async () => fake.target);
  fake.loadCandidates.mockReset();
  fake.loadCandidates.mockImplementation(
    async (_reader: unknown, _target: unknown, options: { candidateIds: string[] | null }) =>
      (fake.candidates as SubstituteCandidateContext[]).filter(
        (entry) => options.candidateIds === null || options.candidateIds.includes(entry.id),
      ),
  );
  fake.loadRules.mockReset();
  fake.loadRules.mockImplementation(async () => fake.rules);
  vi.mocked(revalidatePath).mockClear();
  // Noon in Jakarta on the saved date, so the date is today and never in the future.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-09T05:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("attendance actions module", () => {
  it("opens with the use server directive so client components can call it", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

    expect(source.split("\n")[0].trim()).toBe('"use server";');
  });
});

describe("saveAttendance", () => {
  it("refuses a status that does not exist, including sick and leave, and reads nothing", async () => {
    for (const status of ["late", "sick", "leave"]) {
      const res = await saveAttendance(input([entry(ASSIGNMENT_1, status)]));

      expect(res.ok).toBe(false);
    }
    expect(fake.calls).toEqual([]);
  });

  it("saves an insert and an update, and counts them", async () => {
    const res = await saveAttendance(
      input([entry(ASSIGNMENT_1, "present"), entry(ASSIGNMENT_2, "absent", "Fever")]),
    );

    expect(res).toEqual({ ok: true, saved: 2, cleared: 0 });
    expect(fake.calls.every((call) => call.inTransaction)).toBe(true);

    const [insert] = writes();

    expect(insert.op).toBe("insert");
    expect(insert.table).toBe(attendance);
    expect(insert.values).toEqual([
      {
        rosterAssignmentId: ASSIGNMENT_1,
        status: "present",
        reason: null,
        markedBy: "user-1",
        updatedBy: "user-1",
      },
      {
        rosterAssignmentId: ASSIGNMENT_2,
        status: "absent",
        reason: "Fever",
        markedBy: "user-1",
        updatedBy: "user-1",
      },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/attendance");
  });

  it("updates an existing row by its assignment, with updatedBy and updatedAt set and markedBy left", async () => {
    await saveAttendance(input([entry(ASSIGNMENT_2, "absent", "Fever")]));

    const [insert] = writes();

    expect(insert.conflict?.target).toBe(attendance.rosterAssignmentId);
    expect(Object.keys(insert.conflict?.set ?? {}).sort()).toEqual([
      "reason",
      "status",
      "updatedAt",
      "updatedBy",
    ]);
    expect(insert.conflict?.set.updatedBy).toBe("user-1");
    expect(insert.conflict?.set.updatedAt).toBeInstanceOf(Date);
  });

  it("deletes the row of an entry with no status and counts it as cleared", async () => {
    const res = await saveAttendance(
      input([entry(ASSIGNMENT_1, null), entry(ASSIGNMENT_2, "absent")]),
    );

    expect(res).toEqual({ ok: true, saved: 1, cleared: 1 });

    const remove = writes().find((call) => call.op === "delete");

    expect(remove?.table).toBe(attendance);
    expect(whereParams(remove?.where)).toEqual([ASSIGNMENT_1]);
  });

  it("only clears when every entry has no status", async () => {
    const res = await saveAttendance(input([entry(ASSIGNMENT_1, null)]));

    expect(res).toEqual({ ok: true, saved: 0, cleared: 1 });
    expect(writes().map((call) => call.op)).toEqual(["delete"]);
  });

  it("locks the rosters and their requests for sharing while it reads", async () => {
    await saveAttendance(input([entry(ASSIGNMENT_1, "present")]));

    const [read] = fake.calls;

    expect(read.op).toBe("select");
    expect(read.lock?.strength).toBe("share");
    expect(read.table).toBe(rosterAssignment);
    // The request is the one fact that can still change under a confirmed roster, so a request
    // cancelled at the same moment waits for this save instead of slipping in after the read.
    expect(read.lock?.of).toEqual([roster, rosterRequest]);
  });

  it("inserts in assignment id order, so two overlapping saves lock rows in the same order", async () => {
    await saveAttendance(
      input([entry(ASSIGNMENT_2, "present"), entry(ASSIGNMENT_1, "absent")]),
    );

    const [insert] = writes();

    expect((insert.values as { rosterAssignmentId: string }[]).map((row) => row.rosterAssignmentId)).toEqual([
      ASSIGNMENT_1,
      ASSIGNMENT_2,
    ]);
  });

  it("stores a 200-character reason, trimmed, and a blank reason as null", async () => {
    const long = "x".repeat(200);

    await saveAttendance(
      input([entry(ASSIGNMENT_1, "absent", `  ${long}  `), entry(ASSIGNMENT_2, "present", "   ")]),
    );

    const [insert] = writes();
    const [first, second] = insert.values as { reason: string | null }[];

    expect(first.reason).toBe(long);
    expect(second.reason).toBeNull();
  });

  it("refuses a 201-character reason", async () => {
    const res = await saveAttendance(input([entry(ASSIGNMENT_1, "absent", "x".repeat(201))]));

    expect(res.ok).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  describe("the day in the location's time zone", () => {
    const WITA = "Asia/Makassar";

    beforeEach(() => {
      fake.rows = { assignments: [stored(ASSIGNMENT_1, { timezone: WITA })] };
    });

    it("refuses a day after today and writes nothing", async () => {
      // 00:00:01 on 2026-11-10 in Makassar, when UTC is still 2026-11-09.
      vi.setSystemTime(new Date("2026-11-09T16:00:01Z"));

      const res = await saveAttendance(
        input([entry(ASSIGNMENT_1, "present")], "2026-11-11"),
      );

      expect(res).toEqual({ ok: false, formError: FUTURE_DAY_MESSAGE });
      expect(writes()).toEqual([]);
    });

    it("allows the day that has just started there, though UTC is still the day before", async () => {
      vi.setSystemTime(new Date("2026-11-09T16:00:01Z"));
      fake.rows = {
        assignments: [stored(ASSIGNMENT_1, { timezone: WITA, workDate: "2026-11-10" })],
      };

      const res = await saveAttendance(
        input([entry(ASSIGNMENT_1, "present")], "2026-11-10"),
      );

      expect(res).toEqual({ ok: true, saved: 1, cleared: 0 });
    });

    it("refuses that same day one second earlier", async () => {
      vi.setSystemTime(new Date("2026-11-09T15:59:59Z"));
      fake.rows = {
        assignments: [stored(ASSIGNMENT_1, { timezone: WITA, workDate: "2026-11-10" })],
      };

      const res = await saveAttendance(
        input([entry(ASSIGNMENT_1, "present")], "2026-11-10"),
      );

      expect(res).toEqual({ ok: false, formError: FUTURE_DAY_MESSAGE });
      expect(writes()).toEqual([]);
    });
  });

  describe("an assignment that is not scheduled work on the saved date", () => {
    it.each([
      ["of a draft roster", { rosterStatus: "draft" }],
      ["on an off day", { kind: "off" }],
      ["on a break day", { kind: "break" }],
      ["on another date", { workDate: "2026-11-10" }],
      ["of a request that is no longer approved", { requestStatus: "cancelled" }],
    ])("refuses one %s, names its index, and writes nothing", async (_label, overrides) => {
      fake.rows = { assignments: [stored(ASSIGNMENT_1), stored(ASSIGNMENT_2, overrides)] };

      const res = await saveAttendance(
        input([entry(ASSIGNMENT_1, "present"), entry(ASSIGNMENT_2, "present")]),
      );

      expect(res).toEqual({
        ok: false,
        formError: NOT_SCHEDULED_MESSAGE,
        entryErrors: { 1: NOT_SCHEDULED_MESSAGE },
      });
      expect(writes()).toEqual([]);
    });
  });

  it("refuses an assignment that does not exist and writes nothing", async () => {
    fake.rows = { assignments: [stored(ASSIGNMENT_1)] };

    const res = await saveAttendance(
      input([entry(ASSIGNMENT_1, "present"), entry(MISSING, "present")]),
    );

    expect(res).toEqual({ ok: false, formError: ATTENDANCE_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("refuses assignments that belong to two locations", async () => {
    fake.rows = {
      assignments: [stored(ASSIGNMENT_1), stored(ASSIGNMENT_2, { locationId: LOCATION_A2 })],
    };

    const res = await saveAttendance(
      input([entry(ASSIGNMENT_1, "present"), entry(ASSIGNMENT_2, "present")]),
    );

    expect(res).toEqual({ ok: false, formError: ATTENDANCE_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  describe("access", () => {
    it("refuses admin site of another location as not found and writes nothing", async () => {
      fake.access = adminOther;

      const res = await saveAttendance(input([entry(ASSIGNMENT_1, "present")]));

      expect(res).toEqual({ ok: false, formError: ATTENDANCE_NOT_FOUND_MESSAGE });
      expect(writes()).toEqual([]);
    });

    it.each([
      ["HO", ho],
      ["admin site on their own location", adminA],
    ])("lets %s save", async (_label, role) => {
      fake.access = role;

      const res = await saveAttendance(input([entry(ASSIGNMENT_1, "present")]));

      expect(res).toEqual({ ok: true, saved: 1, cleared: 0 });
    });
  });
});

describe("saveAttendance and replacements", () => {
  it("deletes the replacement of a row set to present, in the same transaction as the upsert", async () => {
    const res = await saveAttendance(
      input([entry(ASSIGNMENT_1, "present"), entry(ASSIGNMENT_2, "absent", "Fever")]),
    );

    expect(res).toEqual({ ok: true, saved: 2, cleared: 0 });
    expect(fake.transactions).toBe(1);

    const [upsert, removal] = writes();

    expect(upsert.op).toBe("insert");
    expect(upsert.table).toBe(attendance);
    expect(removal.op).toBe("delete");
    expect(removal.table).toBe(attendanceSubstitute);
    expect(upsert.transaction).toBe(1);
    expect(removal.transaction).toBe(1);
    // Only the present row: the absent one keeps its replacement.
    expect(whereParams(removal.where)).toEqual([ASSIGNMENT_1]);
  });

  it("does not touch replacements when no entry is set to present", async () => {
    await saveAttendance(input([entry(ASSIGNMENT_2, "absent", "Fever")]));

    expect(writes().filter((call) => call.table === attendanceSubstitute)).toEqual([]);
  });

  it("needs no replacement delete to clear a row, because the foreign key cascade removes it", async () => {
    await saveAttendance(input([entry(ASSIGNMENT_1, null)]));

    expect(writes().map((call) => [call.op, call.table])).toEqual([["delete", attendance]]);
  });
});

describe("setSubstitute", () => {
  it("refuses a bad id with the zod message and reads nothing", async () => {
    const res = await setSubstitute({ assignmentId: "nope", substituteWorkerId: null } as never);

    expect(res).toEqual({ ok: false, formError: "Choose a worker" });
    expect(fake.loadTarget).not.toHaveBeenCalled();
    expect(fake.calls).toEqual([]);
  });

  it("loads the target in one transaction, locked", async () => {
    await setSubstitute(pick(WORKER_COVER));

    expect(fake.transactions).toBe(1);
    expect(fake.loadTarget).toHaveBeenCalledTimes(1);

    const [reader, id, options] = fake.loadTarget.mock.calls[0];

    expect(reader.inTransaction).toBe(true);
    expect(id).toBe(ASSIGNMENT_1);
    expect(options).toEqual({ lock: true });
  });

  it("refuses a missing assignment as not found and writes nothing", async () => {
    fake.target = null;

    const res = await setSubstitute(pick(WORKER_COVER));

    expect(res).toEqual({ ok: false, formError: ATTENDANCE_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  describe("access", () => {
    it("refuses admin site of another location as not found and writes nothing", async () => {
      fake.access = adminOther;

      const res = await setSubstitute(pick(WORKER_COVER));

      expect(res).toEqual({ ok: false, formError: ATTENDANCE_NOT_FOUND_MESSAGE });
      expect(writes()).toEqual([]);
      expect(fake.loadCandidates).not.toHaveBeenCalled();
    });

    it("refuses admin site of another location when removing, and deletes nothing", async () => {
      fake.access = adminOther;

      const res = await setSubstitute(pick(null));

      expect(res).toEqual({ ok: false, formError: ATTENDANCE_NOT_FOUND_MESSAGE });
      expect(writes()).toEqual([]);
    });

    it("lets HO act on a location of any kind", async () => {
      fake.target = target({ locationId: LOCATION_A2 });
      fake.candidates = [candidate(WORKER_COVER, { locationId: LOCATION_A2 })];

      const res = await setSubstitute(pick(WORKER_COVER));

      expect(res).toEqual({ ok: true, warnings: [] });
    });

    it("lets admin site act on their own location", async () => {
      fake.access = adminA;

      const res = await setSubstitute(pick(WORKER_COVER));

      expect(res).toEqual({ ok: true, warnings: [] });
    });
  });

  it.each([
    ["a draft roster", { rosterStatus: "draft" }],
    ["a cancelled request", { requestStatus: "cancelled" }],
    ["an off day", { kind: "off" }],
  ])("refuses a row of %s with the scheduled-work message and writes nothing", async (_label, overrides) => {
    fake.target = target(overrides);

    const res = await setSubstitute(pick(WORKER_COVER));

    expect(res).toEqual({ ok: false, formError: NOT_SCHEDULED_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("refuses a day after today in the location's time zone and writes nothing", async () => {
    fake.target = target({ date: "2026-11-10" });

    const res = await setSubstitute(pick(WORKER_COVER));

    expect(res).toEqual({ ok: false, formError: FUTURE_DAY_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("accepts the day that has just started in Makassar while UTC is still the day before", async () => {
    vi.setSystemTime(new Date("2026-11-09T16:00:01Z"));
    fake.target = target({ date: "2026-11-10", timezone: "Asia/Makassar" });

    const res = await setSubstitute(pick(WORKER_COVER));

    expect(res.ok).toBe(true);
  });

  it("refuses a time zone that is not valid", async () => {
    fake.target = target({ timezone: "Mars/Olympus" });

    const res = await setSubstitute(pick(WORKER_COVER));

    expect(res.ok).toBe(false);
    expect(writes()).toEqual([]);
  });

  it.each([null, "present" as const])(
    "refuses a row that is not Absent (saved as %s) and writes nothing",
    async (status) => {
      fake.target = target({ status });

      const res = await setSubstitute(pick(WORKER_COVER));

      expect(res).toEqual({ ok: false, formError: NEEDS_ABSENT_MESSAGE });
      expect(writes()).toEqual([]);
    },
  );

  it("removes the replacement by attendance id and returns no warnings", async () => {
    const res = await setSubstitute(pick(null));

    expect(res).toEqual({ ok: true, warnings: [] });
    expect(fake.loadCandidates).not.toHaveBeenCalled();

    const [removal, ...rest] = writes();

    expect(rest).toEqual([]);
    expect(removal.op).toBe("delete");
    expect(removal.table).toBe(attendanceSubstitute);
    expect(removal.inTransaction).toBe(true);
    expect(whereParams(removal.where)).toEqual([ATTENDANCE_1]);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/attendance");
  });

  it("refuses a worker that is not an active worker of the location and writes nothing", async () => {
    const res = await setSubstitute(pick(WORKER_ELSEWHERE));

    expect(res).toEqual({ ok: false, formError: SUBSTITUTE_MESSAGES.notAvailable });
    expect(fake.loadCandidates.mock.calls[0][2]).toEqual({ candidateIds: [WORKER_ELSEWHERE] });
    expect(fake.loadCandidates.mock.calls[0][0].inTransaction).toBe(true);
    expect(writes()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("loads the rules of the target's location", async () => {
    await setSubstitute(pick(WORKER_COVER));

    expect(fake.loadRules.mock.calls[0][0].inTransaction).toBe(true);
    expect(fake.loadRules.mock.calls[0][1]).toEqual({ locationId: LOCATION_A });
  });

  it.each([
    ["covers themself", WORKER_ABSENT, {}, SUBSTITUTE_MESSAGES.sameWorker],
    ["works that day", WORKER_COVER, { workDatesToday: true }, SUBSTITUTE_MESSAGES.alreadyWorking],
    ["covers another", WORKER_COVER, { alreadyCovering: true }, SUBSTITUTE_MESSAGES.alreadyCovering],
    [
      "has an ended contract",
      WORKER_COVER,
      { endContract: "2026-11-01" },
      SUBSTITUTE_MESSAGES.contractEnded("2026-11-01"),
    ],
  ])("refuses a worker who %s with the hard reason and writes nothing", async (_l, id, overrides, message) => {
    fake.candidates = [candidate(id, overrides)];

    const res = await setSubstitute(pick(id));

    expect(res).toEqual({ ok: false, formError: message });
    expect(writes()).toEqual([]);
  });

  it("joins every hard reason in one message", async () => {
    fake.candidates = [candidate(WORKER_COVER, { workDatesToday: true, alreadyCovering: true })];

    const res = await setSubstitute(pick(WORKER_COVER));

    expect(res).toEqual({
      ok: false,
      formError: `${SUBSTITUTE_MESSAGES.alreadyWorking} ${SUBSTITUTE_MESSAGES.alreadyCovering}`,
    });
  });

  it("saves with the warnings of the roster rules, and writes one upsert for the assignment's date", async () => {
    fake.candidates = [candidate(WORKER_COVER, { positionIds: [] })];

    const res = await setSubstitute(pick(WORKER_COVER));

    expect(res).toEqual({ ok: true, warnings: ["Does not have the position Cook."] });

    const [upsert, ...rest] = writes();

    expect(rest).toEqual([]);
    expect(upsert.op).toBe("insert");
    expect(upsert.table).toBe(attendanceSubstitute);
    expect(upsert.inTransaction).toBe(true);
    expect(upsert.values).toEqual({
      attendanceId: ATTENDANCE_1,
      substituteWorkerId: WORKER_COVER,
      workDate: DATE,
      createdBy: "user-1",
    });
    expect(upsert.conflict?.target).toBe(attendanceSubstitute.attendanceId);
    expect(Object.keys(upsert.conflict?.set ?? {}).sort()).toEqual([
      "createdAt",
      "createdBy",
      "substituteWorkerId",
    ]);
    expect(upsert.conflict?.set.substituteWorkerId).toBe(WORKER_COVER);
    expect(upsert.conflict?.set.createdBy).toBe("user-1");
    expect(upsert.conflict?.set.createdAt).toBeInstanceOf(Date);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/attendance");
  });

  it("records the editing user, not the user of the first replacement", async () => {
    fake.access = adminA;

    await setSubstitute(pick(WORKER_COVER));

    const [upsert] = writes();

    expect((upsert.values as { createdBy: string }).createdBy).toBe("admin-a");
    expect(upsert.conflict?.set.createdBy).toBe("admin-a");
  });

  it("maps a unique violation inside the transaction to the covers-someone-else message", async () => {
    fake.failOn = "insert";
    fake.failWith = Object.assign(new Error("duplicate key"), { code: "23505" });

    const res = await setSubstitute(pick(WORKER_COVER));

    expect(res).toEqual({ ok: false, formError: SUBSTITUTE_COVERS_MESSAGE });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("maps a unique violation wrapped in a cause the same way", async () => {
    fake.failOn = "insert";
    fake.failWith = new Error("failed", { cause: { code: "23505" } });

    const res = await setSubstitute(pick(WORKER_COVER));

    expect(res).toEqual({ ok: false, formError: SUBSTITUTE_COVERS_MESSAGE });
  });

  it("rethrows an error that is not a unique violation", async () => {
    const boom = Object.assign(new Error("connection lost"), { code: "08006" });

    fake.failOn = "insert";
    fake.failWith = boom;

    await expect(setSubstitute(pick(WORKER_COVER))).rejects.toBe(boom);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("listSubstituteCandidates", () => {
  const list = (assignmentId = ASSIGNMENT_1) => listSubstituteCandidates({ assignmentId });

  it("returns an empty list for a bad id and reads nothing", async () => {
    await expect(listSubstituteCandidates({ assignmentId: "nope" })).resolves.toEqual([]);
    expect(fake.loadTarget).not.toHaveBeenCalled();
  });

  it("reads without a lock and without a transaction, and writes nothing", async () => {
    await list();

    expect(fake.transactions).toBe(0);
    expect(fake.loadTarget.mock.calls[0][0].inTransaction).toBe(false);
    expect(fake.loadTarget.mock.calls[0][2]).toBeUndefined();
    expect(fake.loadCandidates.mock.calls[0][2]).toEqual({ candidateIds: null });
    expect(writes()).toEqual([]);
  });

  it("returns an empty list for a missing assignment", async () => {
    fake.target = null;

    await expect(list()).resolves.toEqual([]);
    expect(fake.loadCandidates).not.toHaveBeenCalled();
  });

  it("returns an empty list for admin site of another location, and loads no candidates", async () => {
    fake.access = adminOther;

    await expect(list()).resolves.toEqual([]);
    expect(fake.loadCandidates).not.toHaveBeenCalled();
  });

  it("returns the list to HO and to admin site of the location", async () => {
    for (const who of [ho, adminA]) {
      fake.access = who;

      expect(await list()).toHaveLength(1);
    }
  });

  it.each([
    ["not marked", { status: null }],
    ["present", { status: "present" as const }],
    ["a draft roster", { rosterStatus: "draft" }],
    ["a cancelled request", { requestStatus: "cancelled" }],
    ["an off day", { kind: "off" }],
  ])("returns an empty list for a row that is %s", async (_label, overrides) => {
    fake.target = target(overrides);

    await expect(list()).resolves.toEqual([]);
    expect(fake.loadCandidates).not.toHaveBeenCalled();
  });

  it("leaves out the absent worker, keeps the loader's order, and carries hard and warnings", async () => {
    fake.candidates = [
      candidate(WORKER_ABSENT),
      candidate(WORKER_COVER, { positionIds: [] }),
      candidate(WORKER_OTHER, { workDatesToday: true }),
    ];

    const options = await list();

    expect(options.map((option) => option.workerId)).toEqual([WORKER_COVER, WORKER_OTHER]);
    expect(options).toEqual([
      {
        workerId: WORKER_COVER,
        employeeId: "E-02",
        name: "Worker 02",
        positionNames: ["Cook"],
        hard: [],
        warnings: ["Does not have the position Cook."],
      },
      {
        workerId: WORKER_OTHER,
        employeeId: "E-03",
        name: "Worker 03",
        positionNames: ["Cook"],
        hard: [SUBSTITUTE_MESSAGES.alreadyWorking],
        warnings: [],
      },
    ]);
  });
});
