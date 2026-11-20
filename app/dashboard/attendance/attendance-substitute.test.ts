import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { attendance, attendanceSubstitute } from "@/database/schema/attendance-schema";
import { roster, rosterAssignment } from "@/database/schema/roster-schema";
import { rosterRequest } from "@/database/schema/request-schema";
import { worker } from "@/database/schema/worker-schema";
import type { SubstituteTarget } from "@/types/attendance";
import type { EngineHistory, Reader } from "@/types/rosters";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
// The history and position loaders belong to rosters and have their own tests. Here they are only
// checked for what they are asked.
vi.mock("../rosters/rosters", () => ({
  loadHistories: async (_reader: unknown, ids: string[], days: string[]) => {
    fake.historyCalls.push({ ids, days });

    return ids.map((id) => ({ ...EMPTY_HISTORY, workerId: id }));
  },
  loadWorkerPositions: async (_reader: unknown, ids: string[]) => {
    fake.positionCalls.push(ids);

    return new Map(ids.map((id) => [id, { ids: [`p-${id}`], names: [`Position ${id}`] }]));
  },
}));

const { loadSubstituteCandidates, loadSubstituteTarget } = await import("./attendance-substitute");

const ASSIGNMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const ATTENDANCE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const LOCATION_ID = "33333333-3333-4333-8333-333333333333";
const W1 = "99999999-9999-4999-8999-999999999991";
const W2 = "99999999-9999-4999-8999-999999999992";
const W3 = "99999999-9999-4999-8999-999999999993";

const EMPTY_HISTORY: EngineHistory = {
  workerId: "",
  lastWorkDate: null,
  lastShiftOrder: null,
  consecutiveWorkDays: 0,
  monthWorkDays: {},
  lastPlacement: null,
};

type Lock = { strength: string; config?: { of?: unknown[] } };
type Call = { table: unknown; where?: SQL; lock?: Lock };

const dialect = new PgDialect();

const fake = {
  calls: [] as Call[],
  rows: new Map<unknown, unknown[]>(),
  historyCalls: [] as { ids: string[]; days: string[] }[],
  positionCalls: [] as string[][],
};

// Each select is answered by the table in `.from(...)`. The target read and the attendance lock
// read are told apart by their table, since the target read starts from the assignment.
const reader = {
  select: () => {
    const call: Call = { table: undefined };

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
      for(strength: string, config?: { of?: unknown[] }) {
        call.lock = { strength, config };
        return chain;
      },
      then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
        return new Promise((done) => done(fake.rows.get(call.table) ?? [])).then(resolve, reject);
      },
    };

    return chain;
  },
} as unknown as Reader;

beforeEach(() => {
  fake.calls = [];
  fake.rows = new Map();
  fake.historyCalls = [];
  fake.positionCalls = [];
});

const params = (call: Call) => dialect.sqlToQuery(call.where!);
const callsOn = (table: unknown) => fake.calls.filter((call) => call.table === table);

const targetRow = (overrides: Record<string, unknown> = {}) => ({
  assignmentId: ASSIGNMENT_ID,
  attendanceId: null,
  status: null,
  workerId: W1,
  date: "2026-11-09",
  locationId: LOCATION_ID,
  timezone: "Asia/Jakarta",
  rosterStatus: "confirmed",
  requestStatus: "approved",
  kind: "work",
  shiftOrder: 1,
  positionId: "pos-1",
  positionName: "Operator",
  departmentId: "dep-1",
  subDepartmentId: null,
  ...overrides,
});

describe("loadSubstituteTarget", () => {
  it("returns null for an assignment that does not exist", async () => {
    expect(await loadSubstituteTarget(reader, ASSIGNMENT_ID)).toBeNull();
  });

  it("gives a null status and attendance id when the day has no attendance row", async () => {
    fake.rows.set(rosterAssignment, [targetRow()]);

    const target = await loadSubstituteTarget(reader, ASSIGNMENT_ID);

    expect(target).toEqual({
      assignmentId: ASSIGNMENT_ID,
      attendanceId: null,
      status: null,
      workerId: W1,
      date: "2026-11-09",
      locationId: LOCATION_ID,
      timezone: "Asia/Jakarta",
      rosterStatus: "confirmed",
      requestStatus: "approved",
      kind: "work",
      shiftOrder: 1,
      position: { id: "pos-1", name: "Operator" },
      departmentId: "dep-1",
      subDepartmentId: null,
    });
    expect(params(callsOn(rosterAssignment)[0]).params).toContain(ASSIGNMENT_ID);
  });

  it("gives the absent status and the attendance id when the day is marked", async () => {
    fake.rows.set(rosterAssignment, [targetRow({ attendanceId: ATTENDANCE_ID, status: "absent" })]);

    const target = await loadSubstituteTarget(reader, ASSIGNMENT_ID);

    expect(target).toMatchObject({ attendanceId: ATTENDANCE_ID, status: "absent" });
  });

  it("reads without locking by default", async () => {
    fake.rows.set(rosterAssignment, [targetRow()]);

    await loadSubstituteTarget(reader, ASSIGNMENT_ID);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].lock).toBeUndefined();
  });

  it("with lock, share-locks the roster and request and locks the attendance row in its own read", async () => {
    fake.rows.set(rosterAssignment, [targetRow({ attendanceId: null, status: null })]);
    fake.rows.set(attendance, [{ id: ATTENDANCE_ID, status: "present" }]);

    const target = await loadSubstituteTarget(reader, ASSIGNMENT_ID, { lock: true });

    const [read] = callsOn(rosterAssignment);
    const [lockRead] = callsOn(attendance);

    expect(read.lock).toEqual({ strength: "share", config: { of: [roster, rosterRequest] } });
    // FOR UPDATE is refused on the nullable side of an outer join, so the attendance row is locked
    // by a statement of its own.
    expect(lockRead).not.toBe(read);
    expect(lockRead.lock?.strength).toBe("update");
    expect(params(lockRead).params).toContain(ASSIGNMENT_ID);
    expect(fake.calls.indexOf(lockRead)).toBeGreaterThan(fake.calls.indexOf(read));
    // The locked read is the one to trust for the status.
    expect(target).toMatchObject({ attendanceId: ATTENDANCE_ID, status: "present" });
  });

  it("with lock, reports no attendance when the locked read finds none", async () => {
    fake.rows.set(rosterAssignment, [targetRow({ attendanceId: ATTENDANCE_ID, status: "absent" })]);

    const target = await loadSubstituteTarget(reader, ASSIGNMENT_ID, { lock: true });

    expect(target).toMatchObject({ attendanceId: null, status: null });
  });

  it("with lock, does not lock the attendance row of an assignment that does not exist", async () => {
    expect(await loadSubstituteTarget(reader, ASSIGNMENT_ID, { lock: true })).toBeNull();
    expect(callsOn(attendance)).toHaveLength(0);
  });
});

const target = (overrides: Partial<SubstituteTarget> = {}): SubstituteTarget => ({
  assignmentId: ASSIGNMENT_ID,
  attendanceId: ATTENDANCE_ID,
  status: "absent",
  workerId: W1,
  date: "2026-11-09",
  locationId: LOCATION_ID,
  timezone: "Asia/Jakarta",
  rosterStatus: "confirmed",
  requestStatus: "approved",
  kind: "work",
  shiftOrder: 1,
  position: { id: "pos-1", name: "Operator" },
  departmentId: "dep-1",
  subDepartmentId: null,
  ...overrides,
});

const seedWorkers = () =>
  fake.rows.set(worker, [
    { id: W2, employeeId: "E-2", name: "Sari", endContract: "2027-01-01" },
    { id: W3, employeeId: "E-3", name: "Dewi", endContract: "2027-02-01" },
  ]);

describe("loadSubstituteCandidates", () => {
  it("scopes the pool to the active workers of the target's location", async () => {
    seedWorkers();

    await loadSubstituteCandidates(reader, target(), { candidateIds: null });

    const { sql, params: bound } = params(callsOn(worker)[0]);

    expect(bound).toContain(LOCATION_ID);
    expect(sql).toMatch(/"worker"\."location_id" = \$\d+/);
    expect(sql).toMatch(/"worker"\."deleted_at" is null/);
    expect(sql).not.toMatch(/"worker"\."id" in/);
  });

  it("limits the pool to the given ids", async () => {
    seedWorkers();

    await loadSubstituteCandidates(reader, target(), { candidateIds: [W2] });

    const { sql, params: bound } = params(callsOn(worker)[0]);

    expect(sql).toMatch(/"worker"\."id" in/);
    expect(bound).toContain(W2);
  });

  it("returns an id that is not an active worker of the location as absent", async () => {
    fake.rows.set(worker, [{ id: W2, employeeId: "E-2", name: "Sari", endContract: "2027-01-01" }]);

    const result = await loadSubstituteCandidates(reader, target(), { candidateIds: [W2, W3] });

    expect(result.map((entry) => entry.id)).toEqual([W2]);
  });

  it("does not query anything else when the pool is empty", async () => {
    const result = await loadSubstituteCandidates(reader, target(), { candidateIds: null });

    expect(result).toEqual([]);
    expect(fake.calls).toHaveLength(1);
    expect(fake.positionCalls).toEqual([]);
    expect(fake.historyCalls).toEqual([]);
  });

  it("does not query at all for an empty id list", async () => {
    seedWorkers();

    const result = await loadSubstituteCandidates(reader, target(), { candidateIds: [] });

    expect(result).toEqual([]);
    expect(fake.calls).toHaveLength(0);
  });

  it("binds the date and the work kind in the assigned-that-day query, on approved requests", async () => {
    seedWorkers();

    await loadSubstituteCandidates(reader, target(), { candidateIds: null });

    const { sql, params: bound } = params(callsOn(rosterAssignment)[0]);

    expect(bound).toContain("2026-11-09");
    expect(bound).toContain("work");
    expect(bound).toContain("approved");
    expect(bound).toEqual(expect.arrayContaining([W2, W3]));
    expect(sql).toMatch(/"roster_assignment"\."work_date" = \$\d+/);
    expect(sql).toMatch(/"roster_assignment"\."kind" = \$\d+/);
  });

  it("excludes the target's own attendance row from the covering query", async () => {
    seedWorkers();

    await loadSubstituteCandidates(reader, target(), { candidateIds: null });

    const { sql, params: bound } = params(callsOn(attendanceSubstitute)[0]);

    expect(bound).toContain("2026-11-09");
    expect(bound).toContain(ATTENDANCE_ID);
    expect(sql).toMatch(/"attendance_substitute"\."work_date" = \$\d+/);
    expect(sql).toMatch(/"attendance_substitute"\."attendance_id" <> \$\d+/);
  });

  it("leaves the attendance row out of the covering query when the target has none", async () => {
    seedWorkers();

    await loadSubstituteCandidates(reader, target({ attendanceId: null, status: null }), {
      candidateIds: null,
    });

    const { sql } = params(callsOn(attendanceSubstitute)[0]);

    expect(sql).not.toMatch(/"attendance_id"/);
  });

  it("flags who is assigned that day and who already covers, and passes the history and positions on", async () => {
    seedWorkers();
    fake.rows.set(rosterAssignment, [{ workerId: W2 }]);
    fake.rows.set(attendanceSubstitute, [{ workerId: W3 }]);

    const result = await loadSubstituteCandidates(reader, target(), { candidateIds: null });

    expect(result).toEqual([
      {
        id: W2,
        employeeId: "E-2",
        name: "Sari",
        positionIds: [`p-${W2}`],
        positionNames: [`Position ${W2}`],
        endContract: "2027-01-01",
        deleted: false,
        locationId: LOCATION_ID,
        workDatesToday: true,
        alreadyCovering: false,
        history: { ...EMPTY_HISTORY, workerId: W2 },
      },
      {
        id: W3,
        employeeId: "E-3",
        name: "Dewi",
        positionIds: [`p-${W3}`],
        positionNames: [`Position ${W3}`],
        endContract: "2027-02-01",
        deleted: false,
        locationId: LOCATION_ID,
        workDatesToday: false,
        alreadyCovering: true,
        history: { ...EMPTY_HISTORY, workerId: W3 },
      },
    ]);
    expect(fake.positionCalls).toEqual([[W2, W3]]);
    expect(fake.historyCalls).toEqual([{ ids: [W2, W3], days: ["2026-11-09"] }]);
  });
});
