import { readFileSync } from "node:fs";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { department, subDepartment } from "@/database/schema/department-schema";
import { location } from "@/database/schema/location-schema";
import { position } from "@/database/schema/position-schema";
import {
  rosterRequest,
  rosterRequestLine,
  rosterRequestLineDay,
} from "@/database/schema/request-schema";
import { roster } from "@/database/schema/roster-schema";
import { shift } from "@/database/schema/shift-schema";
import type { RequestAccess, RequestActor } from "@/types/requests";
import { START_DATE_PAST_MESSAGE } from "@/validation/request";
import { formatPoNumber, poPeriod } from "./po-number";
import {
  DAILY_HEADCOUNT_MESSAGE,
  HEADCOUNT_LENGTH_MESSAGE,
  INVALID_TIMEZONE_MESSAGE,
  LOCATION_NOT_FOUND_MESSAGE,
  NOT_CANCELLABLE_MESSAGE,
  NOT_EDITABLE_MESSAGE,
  NOT_PENDING_MESSAGE,
  REASON_REQUIRED_MESSAGE,
  REQUEST_HAS_ROSTER_MESSAGE,
  REQUEST_NOT_FOUND_MESSAGE,
  WEEKLY_HEADCOUNT_MESSAGE,
} from "./request-rules";

// The database is replaced by a recorder. Every query is logged as a Call, and the result of a
// read comes from `rows`, keyed by the table it reads. The recorder cannot run a WHERE clause, so
// scope is simulated by leaving `rows.request` empty, and a guarded status update returns a row
// only when its WHERE names the stored status.
type Call = {
  op: "select" | "insert" | "update" | "delete" | "counter";
  table?: unknown;
  fields?: Record<string, unknown>;
  values?: unknown;
  set?: Record<string, unknown>;
  lock?: string;
  where?: SQL;
  tx?: unknown;
  inTx?: boolean;
};

const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  rows: {
    location: [] as unknown[],
    departments: [] as unknown[],
    subDepartments: [] as unknown[],
    positions: [] as unknown[],
    shifts: [] as unknown[],
    request: [] as { id: string; status: string }[],
    roster: [] as unknown[],
  },
  actor: null as unknown,
  access: null as unknown,
  sequence: 1,
  tx: null as unknown,
  inTx: false,
}));

const dialect = new PgDialect();
const STATUSES = ["pending", "approved", "rejected", "cancelled"];

function whereParams(where: SQL | undefined): unknown[] {
  return where ? dialect.sqlToQuery(where).params : [];
}

function result(call: Call): unknown {
  if (call.op === "select") {
    if (call.table === location) return fake.rows.location;
    if (call.table === department) return fake.rows.departments;
    if (call.table === subDepartment) return fake.rows.subDepartments;
    if (call.table === position) return fake.rows.positions;
    if (call.table === shift) return fake.rows.shifts;
    if (call.table === rosterRequest) return fake.rows.request;
    if (call.table === roster) return fake.rows.roster;
    return [];
  }

  if (call.op === "insert" && call.table === rosterRequest) {
    return [{ id: "request-new" }];
  }

  if (call.op === "update" && call.table === rosterRequest) {
    const stored = fake.rows.request[0];
    if (!stored) return [];

    const statuses = whereParams(call.where).filter((p) => STATUSES.includes(p as string));
    if (statuses.length > 0 && !statuses.includes(stored.status)) return [];

    return [{ id: stored.id }];
  }

  return [];
}

function builder(call: Call) {
  call.inTx = fake.inTx;
  fake.calls.push(call);

  const chain = {
    from(table: unknown) {
      call.table = table;
      return chain;
    },
    leftJoin: () => chain,
    innerJoin: () => chain,
    where(where: SQL) {
      call.where = where;
      return chain;
    },
    orderBy: () => chain,
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

const query = {
  select: (fields?: Record<string, unknown>) => builder({ op: "select", fields }),
  insert: (table: unknown) => builder({ op: "insert", table }),
  update: (table: unknown) => builder({ op: "update", table }),
  delete: (table: unknown) => builder({ op: "delete", table }),
};

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./request-guard", () => ({
  requireRequestUser: async () => ({ user: fake.actor, access: fake.access }),
}));
vi.mock("@/lib/db", () => {
  // The real po-counter runs against this fake: its one tx.execute is the upsert on po_counter.
  // It answers with the current sequence and then moves on, like the stored counter would.
  const tx = {
    ...query,
    inTransaction: true,
    execute: async (statement: SQL) => {
      fake.calls.push({
        op: "counter",
        tx: fake.tx,
        inTx: fake.inTx,
        values: dialect.sqlToQuery(statement),
      });
      const lastValue = fake.sequence;
      fake.sequence += 1;

      return { rows: [{ last_value: lastValue }] };
    },
  };
  fake.tx = tx;

  return {
    db: {
      ...query,
      transaction: async (run: (t: typeof tx) => unknown) => {
        fake.inTx = true;

        try {
          return await run(tx);
        } finally {
          fake.inTx = false;
        }
      },
    },
  };
});

const { revalidatePath } = await import("next/cache");
const { createRequest, updateRequest, cancelRequest, approveRequest, rejectRequest } =
  await import("./actions");

const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";
const DEPT_A = "55555555-5555-4555-8555-555555555555";
const DEPT_B = "66666666-6666-4666-8666-666666666666";
const SUB_A = "77777777-7777-4777-8777-777777777777";
const POSITION_A = "88888888-8888-4888-8888-888888888888";
const POSITION_B = "99999999-9999-4999-8999-999999999999";
const SHIFT_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SHIFT_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type Role = { actor: RequestActor; access: RequestAccess };

const hoA: Role = {
  actor: { id: "ho-a", name: "HO A", role: "ho", locationId: null },
  access: { locationId: null },
};
const adminA: Role = {
  actor: { id: "admin-a", name: "Admin A", role: "admin_site", locationId: LOCATION_A },
  access: { locationId: LOCATION_A },
};
const adminB: Role = {
  actor: { id: "admin-b", name: "Admin B", role: "admin_site", locationId: LOCATION_B },
  access: { locationId: LOCATION_B },
};

function actAs(role: Role) {
  fake.actor = role.actor;
  fake.access = role.access;
}

const FUTURE = "2099-01-05";
const PAST = "2020-01-06";

const line = {
  departmentId: DEPT_A,
  subDepartmentId: SUB_A,
  positionId: POSITION_A,
  shiftId: null,
  headcounts: [3],
};

const ZERO_WEEK = [0, 0, 0, 0, 0, 0, 0];

const WEEK = [0, 3, 3, 0, 5, 5, 5];

const weeklyLine = { ...line, headcounts: WEEK };

const createInput = {
  type: "daily" as const,
  startDate: FUTURE,
  locationId: LOCATION_A,
  lines: [line],
};

const weeklyCreateInput = { ...createInput, type: "weekly" as const, lines: [weeklyLine] };

// The stored request is weekly unless a test says otherwise, so the default update is weekly too.
const updateInput = { startDate: FUTURE, lines: [weeklyLine] };

const dailyUpdateInput = { startDate: FUTURE, lines: [line] };

function seedLocationChoices(timezone = "Asia/Jakarta") {
  fake.rows.location = [
    { id: LOCATION_A, timezone },
  ];
  fake.rows.departments = [{ id: DEPT_A }];
  fake.rows.subDepartments = [{ id: SUB_A, departmentId: DEPT_A }];
  fake.rows.positions = [{ id: POSITION_A }];
  fake.rows.shifts = [{ id: SHIFT_A }];
}

function storedRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    type: "weekly",
    status: "pending",
    startDate: FUTURE,
    locationId: LOCATION_A,
    timezone: "Asia/Jakarta",
    ...overrides,
  };
}

const writes = () =>
  fake.calls.filter((call) => call.op !== "select" && call.op !== "counter");
const counterCalls = () => fake.calls.filter((call) => call.op === "counter");
const counterParams = () =>
  counterCalls().map((call) => (call.values as { params: unknown[] }).params);
const requestUpdate = () =>
  fake.calls.find((call) => call.op === "update" && call.table === rosterRequest);

type LineRow = { id: string } & Record<string, unknown>;
type DayRow = { lineId: string; dayOffset: number; headcount: number };

const lineInserts = () =>
  fake.calls.filter((call) => call.op === "insert" && call.table === rosterRequestLine);
const dayInserts = () =>
  fake.calls.filter((call) => call.op === "insert" && call.table === rosterRequestLineDay);

beforeEach(() => {
  fake.calls = [];
  fake.rows = {
    location: [],
    departments: [],
    subDepartments: [],
    positions: [],
    shifts: [],
    request: [],
    roster: [],
  };
  fake.sequence = 1;
  actAs(hoA);
  vi.mocked(revalidatePath).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

// 2026-11-30 23:30 in Jakarta, and already 2026-12-01 00:30 in Makassar and Jayapura.
function freezeAtJakartaMonthEnd() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-30T16:30:00Z"));
}

describe("request actions module", () => {
  it("opens with the use server directive so client components can call it", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

    expect(source.split("\n")[0].trim()).toBe('"use server";');
  });
});

describe("createRequest shifts", () => {
  it("refuses a line whose shift is not an active shift of the location, and writes nothing", async () => {
    seedLocationChoices();

    const res = await createRequest({ ...createInput, lines: [{ ...line, shiftId: SHIFT_B }] });

    expect(res).toEqual({
      ok: false,
      fieldErrors: { lines: "Choose a shift of this location" },
    });
    expect(writes()).toEqual([]);
  });

  it("stores the shift on the line", async () => {
    seedLocationChoices();

    const res = await createRequest({ ...createInput, lines: [{ ...line, shiftId: SHIFT_A }] });

    expect(res.ok).toBe(true);
    expect(lineInserts()[0].values).toEqual([expect.objectContaining({ shiftId: SHIFT_A })]);
  });

  it("reads the location's shifts under a share lock", async () => {
    seedLocationChoices();

    await createRequest({ ...createInput, lines: [{ ...line, shiftId: SHIFT_A }] });

    const read = fake.calls.find((call) => call.op === "select" && call.table === shift);

    expect(read?.lock).toBe("share");
    expect(whereParams(read?.where)).toContain(LOCATION_A);
  });
});

describe("updateRequest shifts", () => {
  it("refuses a shift of another location and writes nothing", async () => {
    seedLocationChoices();
    fake.rows.request = [storedRequest()];

    const res = await updateRequest(REQUEST_ID, {
      ...updateInput,
      lines: [{ ...weeklyLine, shiftId: SHIFT_B }],
    });

    expect(res).toEqual({
      ok: false,
      fieldErrors: { lines: "Choose a shift of this location" },
    });
    expect(writes()).toEqual([]);
  });

  it("stores the new shift on the replaced lines", async () => {
    seedLocationChoices();
    fake.rows.request = [storedRequest()];

    const res = await updateRequest(REQUEST_ID, {
      ...updateInput,
      lines: [{ ...weeklyLine, shiftId: SHIFT_A }],
    });

    expect(res).toEqual({ ok: true });
    expect(lineInserts()[0].values).toEqual([expect.objectContaining({ shiftId: SHIFT_A })]);
  });
});

describe("createRequest", () => {
  it("creates a daily request as approved with the next PO number, then its lines", async () => {
    actAs(adminA);
    seedLocationChoices();
    const period = poPeriod(new Date(), "Asia/Jakarta");

    const res = await createRequest(createInput);

    expect(res).toEqual({ ok: true, id: "request-new", poNumber: `PO-${period}-0001` });

    const locked = fake.calls.find((c) => c.op === "select" && c.table === location);
    expect(locked?.lock).toBe("share");

    expect(counterParams()).toEqual([[period]]);

    expect(writes().map((c) => c.table)).toEqual([
      rosterRequest,
      rosterRequestLine,
      rosterRequestLineDay,
    ]);
    expect(writes()[0].values).toEqual({
      poNumber: `PO-${period}-0001`,
      type: "daily",
      startDate: FUTURE,
      locationId: LOCATION_A,
      status: "approved",
      createdBy: "admin-a",
      updatedBy: "admin-a",
    });
    expect(writes()[0].values).not.toHaveProperty("note");
    const [lineRow] = writes()[1].values as LineRow[];
    expect(writes()[1].values).toEqual([
      {
        id: expect.any(String),
        requestId: "request-new",
        departmentId: DEPT_A,
        subDepartmentId: SUB_A,
        positionId: POSITION_A,
        shiftId: null,
      },
    ]);
    expect(writes()[2].values).toEqual([{ lineId: lineRow.id, dayOffset: 0, headcount: 3 }]);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/requests");
  });

  it("inserts seven day rows per weekly line, tied to the id each line was inserted with", async () => {
    seedLocationChoices();
    const secondWeek = [1, 1, 1, 1, 1, 1, 2];
    const second = { ...weeklyLine, subDepartmentId: null, headcounts: secondWeek };

    const res = await createRequest({ ...weeklyCreateInput, lines: [weeklyLine, second] });

    expect(res).toMatchObject({ ok: true });
    expect(lineInserts()).toHaveLength(1);
    expect(dayInserts()).toHaveLength(1);

    const lineRows = lineInserts()[0].values as LineRow[];
    const dayRows = dayInserts()[0].values as DayRow[];
    expect(lineRows).toHaveLength(2);
    expect(lineRows.every((row) => !("headcount" in row))).toBe(true);
    expect(new Set(lineRows.map((row) => row.id)).size).toBe(2);

    expect(dayRows).toEqual([
      ...WEEK.map((headcount, dayOffset) => ({ lineId: lineRows[0].id, dayOffset, headcount })),
      ...secondWeek.map((headcount, dayOffset) => ({
        lineId: lineRows[1].id,
        dayOffset,
        headcount,
      })),
    ]);
  });

  it.each([
    ["a weekly line with every day 0", weeklyCreateInput, ZERO_WEEK, WEEKLY_HEADCOUNT_MESSAGE],
    ["a daily line with 0", createInput, [0], DAILY_HEADCOUNT_MESSAGE],
    ["a daily line with seven numbers", createInput, WEEK, HEADCOUNT_LENGTH_MESSAGE],
    ["a weekly line with one number", weeklyCreateInput, [3], HEADCOUNT_LENGTH_MESSAGE],
  ])("refuses %s and writes nothing", async (_label, input, headcounts, message) => {
    seedLocationChoices();

    const res = await createRequest({ ...input, lines: [{ ...line, headcounts }] });

    expect(res).toEqual({ ok: false, fieldErrors: { lines: message } });
    expect(writes()).toEqual([]);
    expect(counterCalls()).toEqual([]);
  });

  it("creates a weekly request as pending", async () => {
    seedLocationChoices();
    fake.sequence = 12;

    const res = await createRequest(weeklyCreateInput);

    expect(res).toMatchObject({
      ok: true,
      poNumber: formatPoNumber(poPeriod(new Date(), "Asia/Jakarta"), 12),
    });
    expect(writes()[0].values).toMatchObject({ type: "weekly", status: "pending" });
  });

  it("refuses a location outside the actor's access and writes nothing", async () => {
    actAs(adminA);
    seedLocationChoices();
    fake.rows.location = [{ id: LOCATION_B, timezone: "Asia/Jakarta" }];

    const res = await createRequest({ ...createInput, locationId: LOCATION_B });

    expect(res).toEqual({ ok: false, formError: LOCATION_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
    expect(counterCalls()).toEqual([]);
  });

  it("checks the loaded location row, not the id the client sent", async () => {
    actAs(adminB);
    seedLocationChoices();

    const res = await createRequest({ ...createInput, locationId: LOCATION_B });

    expect(res).toEqual({ ok: false, formError: LOCATION_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
    expect(counterCalls()).toEqual([]);
  });

  it("lets admin site create for its own location", async () => {
    actAs(adminB);
    fake.rows.location = [{ id: LOCATION_B, timezone: "Asia/Jakarta" }];
    fake.rows.departments = [{ id: DEPT_A }];
    fake.rows.subDepartments = [{ id: SUB_A, departmentId: DEPT_A }];
    fake.rows.positions = [{ id: POSITION_A }];

    const res = await createRequest({ ...createInput, locationId: LOCATION_B });

    expect(res).toMatchObject({ ok: true });
    expect(writes()[0].values).toMatchObject({ locationId: LOCATION_B, createdBy: "admin-b" });
  });

  it("lets HO create for any location", async () => {
    actAs(hoA);
    fake.rows.location = [{ id: LOCATION_B, timezone: "Asia/Jakarta" }];
    fake.rows.departments = [{ id: DEPT_A }];
    fake.rows.subDepartments = [{ id: SUB_A, departmentId: DEPT_A }];
    fake.rows.positions = [{ id: POSITION_A }];

    const res = await createRequest({ ...createInput, locationId: LOCATION_B });

    expect(res).toMatchObject({ ok: true });
    expect(writes()[0].values).toMatchObject({ locationId: LOCATION_B });
  });

  it("loads the location with a share lock and a deleted_at filter, and no site join", async () => {
    seedLocationChoices();

    await createRequest(createInput);

    const locked = fake.calls.find((c) => c.op === "select" && c.table === location);

    expect(locked?.lock).toBe("share");
    expect(Object.keys(locked?.fields ?? {}).sort()).toEqual(["id", "timezone"]);
    expect(dialect.sqlToQuery(locked?.where as SQL).sql).toContain('"location"."deleted_at" is null');
  });

  it("refuses a missing or deleted location and writes nothing", async () => {
    seedLocationChoices();
    fake.rows.location = [];

    const res = await createRequest(createInput);

    expect(res).toEqual({ ok: false, formError: LOCATION_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("refuses a department from another location and inserts nothing", async () => {
    seedLocationChoices();

    const res = await createRequest({
      ...createInput,
      lines: [{ ...line, departmentId: DEPT_B, subDepartmentId: null }],
    });

    expect(res).toEqual({
      ok: false,
      fieldErrors: { lines: "Choose a department from this location" },
    });
    expect(writes()).toEqual([]);
    expect(counterCalls()).toEqual([]);
  });

  it("refuses a position that is not an active position and inserts nothing", async () => {
    seedLocationChoices();

    const res = await createRequest({
      ...createInput,
      lines: [{ ...line, positionId: POSITION_B }],
    });

    expect(res).toEqual({ ok: false, fieldErrors: { lines: "Choose an active position" } });
    expect(writes()).toEqual([]);
  });

  it("maps validation errors to fields and reads nothing", async () => {
    const res = await createRequest({ ...createInput, startDate: PAST, lines: [] });

    expect(res).toEqual({
      ok: false,
      fieldErrors: { startDate: "Start date cannot be in the past", lines: "Add at least one line" },
    });
    expect(fake.calls).toEqual([]);
  });
});

describe("createRequest PO number", () => {
  it("ends in -0008 when the period counter returns 8", async () => {
    seedLocationChoices();
    fake.sequence = 8;
    const period = poPeriod(new Date(), "Asia/Jakarta");

    const res = await createRequest(createInput);

    expect(res).toEqual({ ok: true, id: "request-new", poNumber: `PO-${period}-0008` });
    expect(writes()[0].values).toMatchObject({ poNumber: `PO-${period}-0008` });
    expect(writes()[0].values).not.toHaveProperty("siteId");
  });

  it("issues the number with one upsert keyed by the period alone, in the insert's transaction", async () => {
    seedLocationChoices();
    fake.sequence = 8;
    const period = poPeriod(new Date(), "Asia/Jakarta");

    await createRequest(createInput);

    const [counter, ...others] = counterCalls();
    const { sql: statement, params } = counter.values as { sql: string; params: unknown[] };
    const insertIndex = fake.calls.findIndex(
      (call) => call.op === "insert" && call.table === rosterRequest,
    );

    expect(others).toEqual([]);
    expect(params).toEqual([period]);
    expect(statement).toContain("insert into po_counter (period, last_value)");
    expect(statement).toContain("on conflict (period)");
    expect(statement).toContain("do update set last_value = po_counter.last_value + 1");
    expect(statement).toContain("returning last_value");
    expect(statement).not.toContain("site");
    expect(counter.tx).toBe(fake.tx);
    expect(counter.inTx).toBe(true);
    expect(fake.calls[insertIndex].inTx).toBe(true);
    expect(fake.calls.indexOf(counter)).toBeLessThan(insertIndex);
  });

  it("gives two requests of the same month consecutive numbers", async () => {
    seedLocationChoices();
    fake.sequence = 7;
    const period = poPeriod(new Date(), "Asia/Jakarta");

    const first = await createRequest(createInput);
    const second = await createRequest(createInput);

    expect(first).toMatchObject({ ok: true, poNumber: `PO-${period}-0007` });
    expect(second).toMatchObject({ ok: true, poNumber: `PO-${period}-0008` });
  });

  it("does not truncate a sequence above 9999", async () => {
    seedLocationChoices();
    fake.sequence = 10000;
    const period = poPeriod(new Date(), "Asia/Jakarta");

    const res = await createRequest(createInput);

    expect(res).toMatchObject({ ok: true, poNumber: `PO-${period}-10000` });
  });
});

describe("createRequest in the location's time zone", () => {
  it("accepts today in a Jakarta location and issues the Jakarta month", async () => {
    freezeAtJakartaMonthEnd();
    seedLocationChoices("Asia/Jakarta");

    const res = await createRequest({ ...createInput, startDate: "2026-11-30" });

    expect(res).toMatchObject({ ok: true });
    expect(counterParams()).toEqual([["202611"]]);
  });

  it("refuses a date that is already past in the location's zone and writes nothing", async () => {
    freezeAtJakartaMonthEnd();
    seedLocationChoices("Asia/Makassar");

    const res = await createRequest({ ...createInput, startDate: "2026-11-30" });

    expect(res).toEqual({
      ok: false,
      fieldErrors: { startDate: START_DATE_PAST_MESSAGE },
    });
    expect(writes()).toEqual([]);
    expect(counterCalls()).toEqual([]);
  });

  it("accepts today in a Makassar location and issues the next month", async () => {
    freezeAtJakartaMonthEnd();
    seedLocationChoices("Asia/Makassar");

    const res = await createRequest({ ...createInput, startDate: "2026-12-01" });

    expect(res).toMatchObject({ ok: true });
    expect(counterParams()).toEqual([["202612"]]);
  });

  it("issues different periods for two locations at the same instant", async () => {
    freezeAtJakartaMonthEnd();

    seedLocationChoices("Asia/Jakarta");
    await createRequest({ ...createInput, startDate: "2026-12-01" });
    seedLocationChoices("Asia/Makassar");
    await createRequest({ ...createInput, startDate: "2026-12-01" });

    expect(counterParams()).toEqual([["202611"], ["202612"]]);
  });

  it("reports a past start date and a line error together", async () => {
    freezeAtJakartaMonthEnd();
    seedLocationChoices("Asia/Makassar");

    const res = await createRequest({
      ...createInput,
      startDate: "2026-11-30",
      lines: [{ ...line, positionId: POSITION_B }],
    });

    expect(res).toEqual({
      ok: false,
      fieldErrors: {
        startDate: START_DATE_PAST_MESSAGE,
        lines: "Choose an active position",
      },
    });
    expect(writes()).toEqual([]);
  });

  it("still refuses a date before Jakarta's today without reading anything", async () => {
    freezeAtJakartaMonthEnd();

    const res = await createRequest({ ...createInput, startDate: "2026-11-29" });

    expect(res).toEqual({
      ok: false,
      fieldErrors: { startDate: START_DATE_PAST_MESSAGE },
    });
    expect(fake.calls).toEqual([]);
  });
});

describe("updateRequest", () => {
  it("refuses a request that has a roster and writes nothing", async () => {
    seedLocationChoices();
    fake.rows.request = [storedRequest({ status: "approved" })];
    fake.rows.roster = [{ id: "roster-1" }];

    const res = await updateRequest(REQUEST_ID, updateInput);

    expect(res).toEqual({
      ok: false,
      formError: "This request already has a roster and can no longer be edited.",
    });
    expect(REQUEST_HAS_ROSTER_MESSAGE).toBe(
      "This request already has a roster and can no longer be edited.",
    );
    expect(writes()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("looks for the roster inside the transaction, after it has locked the request", async () => {
    seedLocationChoices();
    fake.rows.request = [storedRequest({ status: "approved" })];

    await updateRequest(REQUEST_ID, updateInput);

    const selects = fake.calls.filter((call) => call.op === "select");
    const lockIndex = selects.findIndex((call) => call.table === rosterRequest);
    const rosterIndex = selects.findIndex((call) => call.table === roster);

    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(rosterIndex).toBeGreaterThan(lockIndex);
    expect(whereParams(selects[rosterIndex].where)).toEqual([REQUEST_ID]);
  });

  it("sends an approved weekly back to pending and clears the decision", async () => {
    actAs(hoA);
    seedLocationChoices();
    fake.rows.request = [storedRequest({ status: "approved" })];

    const res = await updateRequest(REQUEST_ID, updateInput);

    expect(res).toEqual({ ok: true });
    const locked = fake.calls.find((c) => c.op === "select" && c.table === rosterRequest);
    expect(locked?.lock).toBe("update");
    expect(whereParams(locked?.where)).toEqual([REQUEST_ID]);

    expect(requestUpdate()?.set).not.toHaveProperty("note");
    expect(requestUpdate()?.set).toEqual({
      startDate: FUTURE,
      status: "pending",
      updatedBy: "ho-a",
      decidedBy: null,
      decidedAt: null,
      rejectReason: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/requests");
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/requests/${REQUEST_ID}`);
  });

  it("keeps an approved daily approved and does not clear the decision", async () => {
    seedLocationChoices();
    fake.rows.request = [storedRequest({ type: "daily", status: "approved" })];

    const res = await updateRequest(REQUEST_ID, dailyUpdateInput);

    expect(res).toEqual({ ok: true });
    expect(requestUpdate()?.set).toEqual({
      startDate: FUTURE,
      status: "approved",
      updatedBy: "ho-a",
    });
  });

  it("replaces the lines by deleting and inserting in the same transaction", async () => {
    seedLocationChoices();
    fake.rows.request = [storedRequest()];

    await updateRequest(REQUEST_ID, {
      ...updateInput,
      lines: [{ ...line, headcounts: [7, 7, 7, 7, 7, 7, 7] }],
    });

    expect(writes().map((c) => [c.op, c.table])).toEqual([
      ["update", rosterRequest],
      ["delete", rosterRequestLine],
      ["insert", rosterRequestLine],
      ["insert", rosterRequestLineDay],
    ]);
    expect(whereParams(writes()[1].where)).toEqual([REQUEST_ID]);
    const [lineRow] = writes()[2].values as LineRow[];
    expect(writes()[2].values).toEqual([
      {
        id: expect.any(String),
        requestId: REQUEST_ID,
        departmentId: DEPT_A,
        subDepartmentId: SUB_A,
        positionId: POSITION_A,
        shiftId: null,
      },
    ]);
    // The old day rows go with the deleted lines through the cascade, so only 7 new rows exist.
    expect(writes()[3].values).toEqual(
      Array.from({ length: 7 }, (_, dayOffset) => ({
        lineId: lineRow.id,
        dayOffset,
        headcount: 7,
      })),
    );
  });

  it.each([
    ["a weekly request with a one-number line", "weekly", [3], HEADCOUNT_LENGTH_MESSAGE],
    ["a daily request with a seven-number line", "daily", WEEK, HEADCOUNT_LENGTH_MESSAGE],
    ["a weekly request with every day 0", "weekly", ZERO_WEEK, WEEKLY_HEADCOUNT_MESSAGE],
    ["a daily request with 0", "daily", [0], DAILY_HEADCOUNT_MESSAGE],
  ])(
    "refuses %s using the stored type and writes nothing",
    async (_label, type, headcounts, message) => {
      seedLocationChoices();
      fake.rows.request = [storedRequest({ type })];

      const res = await updateRequest(REQUEST_ID, {
        ...updateInput,
        lines: [{ ...line, headcounts }],
      });

      expect(res).toEqual({ ok: false, fieldErrors: { lines: message } });
      expect(writes()).toEqual([]);
    },
  );

  it("refuses a cancelled request and writes nothing", async () => {
    seedLocationChoices();
    fake.rows.request = [storedRequest({ status: "cancelled" })];

    const res = await updateRequest(REQUEST_ID, updateInput);

    expect(res).toEqual({ ok: false, formError: NOT_EDITABLE_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("returns not found for a request outside the actor's scope and writes nothing", async () => {
    actAs(adminA);
    seedLocationChoices();
    fake.rows.request = [];

    const res = await updateRequest(REQUEST_ID, updateInput);

    expect(res).toEqual({ ok: false, formError: REQUEST_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
    const locked = fake.calls.find((c) => c.op === "select" && c.table === rosterRequest);
    expect(whereParams(locked?.where)).toEqual([REQUEST_ID, LOCATION_A]);
  });

  it("accepts an unchanged start date that is now in the past", async () => {
    seedLocationChoices();
    fake.rows.request = [storedRequest({ startDate: PAST })];

    const res = await updateRequest(REQUEST_ID, { ...updateInput, startDate: PAST });

    expect(res).toEqual({ ok: true });
  });

  it("refuses a changed start date in the past and writes nothing", async () => {
    seedLocationChoices();
    fake.rows.request = [storedRequest({ startDate: PAST })];

    const res = await updateRequest(REQUEST_ID, { ...updateInput, startDate: "2020-01-07" });

    expect(res).toEqual({
      ok: false,
      fieldErrors: { startDate: "Start date cannot be in the past" },
    });
    expect(writes()).toEqual([]);
  });

  it("refuses a sub-department outside the department and writes nothing", async () => {
    seedLocationChoices();
    fake.rows.request = [storedRequest()];

    const res = await updateRequest(REQUEST_ID, {
      ...updateInput,
      lines: [{ ...weeklyLine, subDepartmentId: POSITION_B }],
    });

    expect(res).toEqual({
      ok: false,
      fieldErrors: { lines: "Choose a sub-department of the selected department" },
    });
    expect(writes()).toEqual([]);
  });
});

describe("a location whose stored time zone is not allowed", () => {
  it("refuses a create with a form error and writes nothing", async () => {
    seedLocationChoices("Asia/Singapore");

    const res = await createRequest(createInput);

    expect(res).toEqual({ ok: false, formError: INVALID_TIMEZONE_MESSAGE });
    expect(writes()).toEqual([]);
    expect(counterCalls()).toEqual([]);
  });

  it("refuses an update that changes the date, with a form error", async () => {
    seedLocationChoices();
    fake.rows.request = [storedRequest({ timezone: "Asia/Singapore" })];

    const res = await updateRequest(REQUEST_ID, { ...updateInput, startDate: "2099-01-06" });

    expect(res).toEqual({ ok: false, formError: INVALID_TIMEZONE_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("still lets an update keep the stored date, because the zone is not needed", async () => {
    seedLocationChoices();
    fake.rows.request = [storedRequest({ timezone: "Asia/Singapore" })];

    const res = await updateRequest(REQUEST_ID, updateInput);

    expect(res).toEqual({ ok: true });
  });
});

describe("updateRequest in the location's time zone", () => {
  it("checks a changed date against the stored location's zone", async () => {
    freezeAtJakartaMonthEnd();
    seedLocationChoices("Asia/Makassar");
    fake.rows.request = [storedRequest({ startDate: "2026-11-29", timezone: "Asia/Makassar" })];

    const res = await updateRequest(REQUEST_ID, { ...updateInput, startDate: "2026-11-30" });

    expect(res).toEqual({
      ok: false,
      fieldErrors: { startDate: START_DATE_PAST_MESSAGE },
    });
    expect(writes()).toEqual([]);
  });

  it("accepts the same date when the stored location is in Jakarta", async () => {
    freezeAtJakartaMonthEnd();
    seedLocationChoices("Asia/Jakarta");
    fake.rows.request = [storedRequest({ startDate: "2026-11-29", timezone: "Asia/Jakarta" })];

    const res = await updateRequest(REQUEST_ID, { ...updateInput, startDate: "2026-11-30" });

    expect(res).toEqual({ ok: true });
  });

  it("still accepts an unchanged past date for a Makassar location", async () => {
    freezeAtJakartaMonthEnd();
    seedLocationChoices("Asia/Makassar");
    fake.rows.request = [storedRequest({ startDate: "2026-11-30", timezone: "Asia/Makassar" })];

    const res = await updateRequest(REQUEST_ID, { ...updateInput, startDate: "2026-11-30" });

    expect(res).toEqual({ ok: true });
  });
});

describe("cancelRequest", () => {
  it.each(["pending", "approved"])("cancels a %s request", async (status) => {
    actAs(adminA);
    fake.rows.request = [storedRequest({ status })];

    const res = await cancelRequest(REQUEST_ID);

    expect(res).toEqual({ ok: true });
    expect(requestUpdate()?.set).toEqual({ status: "cancelled", updatedBy: "admin-a" });
    expect(whereParams(requestUpdate()?.where)).toEqual(
      expect.arrayContaining(["pending", "approved"]),
    );
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/requests/${REQUEST_ID}`);
  });

  it("refuses a rejected request and changes nothing", async () => {
    fake.rows.request = [storedRequest({ status: "rejected" })];

    const res = await cancelRequest(REQUEST_ID);

    expect(res).toEqual({ ok: false, formError: NOT_CANCELLABLE_MESSAGE });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns not found outside the actor's scope and issues no update", async () => {
    actAs(adminA);

    const res = await cancelRequest(REQUEST_ID);

    expect(res).toEqual({ ok: false, formError: REQUEST_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });
});

describe("approveRequest", () => {
  it("returns not found for admin site and issues no update", async () => {
    actAs(adminA);
    fake.rows.request = [storedRequest()];

    const res = await approveRequest(REQUEST_ID);

    expect(res).toEqual({ ok: false, formError: REQUEST_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("returns not found for admin site of another location even when the row is read", async () => {
    actAs(adminB);
    fake.rows.request = [storedRequest()];

    const res = await approveRequest(REQUEST_ID);

    expect(res).toEqual({ ok: false, formError: REQUEST_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("returns not found for a request outside the scope and issues no update", async () => {
    actAs(adminB);

    const res = await approveRequest(REQUEST_ID);

    expect(res).toEqual({ ok: false, formError: REQUEST_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
    const read = fake.calls.find((c) => c.op === "select" && c.table === rosterRequest);
    expect(whereParams(read?.where)).toEqual([REQUEST_ID, LOCATION_B]);
  });

  it("returns not found for an HO that carries a location, like the guard would refuse", async () => {
    actAs({
      actor: { id: "ho-x", name: "HO X", role: "ho", locationId: LOCATION_A },
      access: { locationId: null },
    });
    fake.rows.request = [storedRequest()];

    const res = await approveRequest(REQUEST_ID);

    expect(res).toEqual({ ok: false, formError: REQUEST_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it.each([["HO", hoA]])("lets %s approve a pending request", async (_label, role) => {
    actAs(role);
    fake.rows.request = [storedRequest()];

    const res = await approveRequest(REQUEST_ID);

    expect(res).toEqual({ ok: true });
    const update = requestUpdate();
    expect(update?.set).toMatchObject({
      status: "approved",
      decidedBy: role.actor.id,
      updatedBy: role.actor.id,
      rejectReason: null,
    });
    expect(update?.set?.decidedAt).toBeInstanceOf(Date);
    expect(whereParams(update?.where)).toContain("pending");
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/requests/${REQUEST_ID}`);
  });

  it("refuses a request that is already approved", async () => {
    actAs(hoA);
    fake.rows.request = [storedRequest({ status: "approved" })];

    const res = await approveRequest(REQUEST_ID);

    expect(res).toEqual({ ok: false, formError: NOT_PENDING_MESSAGE });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("rejectRequest", () => {
  it("rejects a pending request with the trimmed reason", async () => {
    actAs(hoA);
    fake.rows.request = [storedRequest()];

    const res = await rejectRequest(REQUEST_ID, "  Not enough budget  ");

    expect(res).toEqual({ ok: true });
    const update = requestUpdate();
    expect(update?.set).toMatchObject({
      status: "rejected",
      rejectReason: "Not enough budget",
      decidedBy: "ho-a",
      updatedBy: "ho-a",
    });
    expect(update?.set?.decidedAt).toBeInstanceOf(Date);
    expect(whereParams(update?.where)).toContain("pending");
  });

  it.each([
    ["empty", "   "],
    ["501-character", "x".repeat(501)],
  ])("refuses an %s reason and changes nothing", async (_label, reason) => {
    actAs(hoA);
    fake.rows.request = [storedRequest()];

    const res = await rejectRequest(REQUEST_ID, reason);

    expect(res).toEqual({ ok: false, formError: REASON_REQUIRED_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("accepts a 500-character reason", async () => {
    fake.rows.request = [storedRequest()];

    const res = await rejectRequest(REQUEST_ID, "x".repeat(500));

    expect(res).toEqual({ ok: true });
  });

  it("returns not found for admin site, in its own or another location, and issues no update", async () => {
    fake.rows.request = [storedRequest()];

    for (const role of [adminA, adminB]) {
      actAs(role);
      const res = await rejectRequest(REQUEST_ID, "No");
      expect(res).toEqual({ ok: false, formError: REQUEST_NOT_FOUND_MESSAGE });
    }

    expect(writes()).toEqual([]);
  });

  it("refuses a request that is no longer pending", async () => {
    fake.rows.request = [storedRequest({ status: "cancelled" })];

    const res = await rejectRequest(REQUEST_ID, "No");

    expect(res).toEqual({ ok: false, formError: NOT_PENDING_MESSAGE });
  });
});

describe("a request id that is not a uuid", () => {
  const calls = [
    ["updateRequest", () => updateRequest("x", updateInput)],
    ["cancelRequest", () => cancelRequest("x")],
    ["approveRequest", () => approveRequest("x")],
    ["rejectRequest", () => rejectRequest("x", "No")],
  ] as const;

  it.each(calls)("%s returns not found and issues no database call", async (_name, run) => {
    fake.rows.request = [storedRequest()];

    const res = await run();

    expect(res).toEqual({ ok: false, formError: REQUEST_NOT_FOUND_MESSAGE });
    expect(fake.calls).toEqual([]);
    expect(counterCalls()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
