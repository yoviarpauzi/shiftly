import { readFileSync } from "node:fs";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attendance } from "@/database/schema/attendance-schema";
import { rosterRequest } from "@/database/schema/request-schema";
import { roster, rosterAssignment } from "@/database/schema/roster-schema";
import type { AttendanceAccess } from "@/types/attendance";
import {
  ATTENDANCE_NOT_FOUND_MESSAGE,
  FUTURE_DAY_MESSAGE,
  NOT_SCHEDULED_MESSAGE,
} from "./attendance-rules";

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
};

const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  rows: { assignments: [] as Record<string, unknown>[] },
  access: null as unknown,
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

function queries(inTransaction: boolean) {
  return {
    select: () => builder({ op: "select", inTransaction }),
    insert: (table: unknown) => builder({ op: "insert", table, inTransaction }),
    delete: (table: unknown) => builder({ op: "delete", table, inTransaction }),
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
    transaction: async (run: (tx: unknown) => unknown) => run(queries(true)),
  },
}));

const { revalidatePath } = await import("next/cache");
const { saveAttendance } = await import("./actions");

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_A2 = "44444444-4444-4444-8444-444444444444";
const ASSIGNMENT_1 = "a0000000-0000-4000-8000-000000000001";
const ASSIGNMENT_2 = "a0000000-0000-4000-8000-000000000002";
const MISSING = "a0000000-0000-4000-8000-0000000000ff";
const DATE = "2026-11-09";

const access = (overrides: Partial<AttendanceAccess>): AttendanceAccess => ({
  userId: "user-1",
  role: "superadmin",
  siteId: null,
  locationId: null,
  ...overrides,
});

const superadmin = access({});
const hoA = access({ userId: "ho-a", role: "ho", siteId: SITE_A });
const hoB = access({ userId: "ho-b", role: "ho", siteId: SITE_B });
const adminA = access({
  userId: "admin-a",
  role: "admin_site",
  siteId: SITE_A,
  locationId: LOCATION_A,
});
const adminOther = access({
  userId: "admin-o",
  role: "admin_site",
  siteId: SITE_A,
  locationId: LOCATION_A2,
});

const stored = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  kind: "work",
  workDate: DATE,
  rosterStatus: "confirmed",
  requestStatus: "approved",
  locationId: LOCATION_A,
  siteId: SITE_A,
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

beforeEach(() => {
  fake.calls = [];
  fake.rows = { assignments: [stored(ASSIGNMENT_1), stored(ASSIGNMENT_2)] };
  fake.access = superadmin;
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
  it("refuses a status that does not exist and reads nothing", async () => {
    const res = await saveAttendance(input([entry(ASSIGNMENT_1, "late")]));

    expect(res.ok).toBe(false);
    expect(fake.calls).toEqual([]);
  });

  it("saves an insert and an update, and counts them", async () => {
    const res = await saveAttendance(
      input([entry(ASSIGNMENT_1, "present"), entry(ASSIGNMENT_2, "sick", "Fever")]),
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
        status: "sick",
        reason: "Fever",
        markedBy: "user-1",
        updatedBy: "user-1",
      },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/attendance");
  });

  it("updates an existing row by its assignment, with updatedBy and updatedAt set and markedBy left", async () => {
    await saveAttendance(input([entry(ASSIGNMENT_2, "sick", "Fever")]));

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
      input([entry(ASSIGNMENT_1, "sick", `  ${long}  `), entry(ASSIGNMENT_2, "leave", "   ")]),
    );

    const [insert] = writes();
    const [first, second] = insert.values as { reason: string | null }[];

    expect(first.reason).toBe(long);
    expect(second.reason).toBeNull();
  });

  it("refuses a 201-character reason", async () => {
    const res = await saveAttendance(input([entry(ASSIGNMENT_1, "sick", "x".repeat(201))]));

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
    it.each([
      ["HO on a location of another site", hoB],
      ["admin site on another location of the same site", adminOther],
    ])("refuses %s as not found and writes nothing", async (_label, role) => {
      fake.access = role;

      const res = await saveAttendance(input([entry(ASSIGNMENT_1, "present")]));

      expect(res).toEqual({ ok: false, formError: ATTENDANCE_NOT_FOUND_MESSAGE });
      expect(writes()).toEqual([]);
    });

    it.each([
      ["superadmin", superadmin],
      ["HO on their own site", hoA],
      ["admin site on their own location", adminA],
    ])("lets %s save", async (_label, role) => {
      fake.access = role;

      const res = await saveAttendance(input([entry(ASSIGNMENT_1, "present")]));

      expect(res).toEqual({ ok: true, saved: 1, cleared: 0 });
    });
  });
});
