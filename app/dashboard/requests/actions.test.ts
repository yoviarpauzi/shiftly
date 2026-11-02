import { readFileSync } from "node:fs";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { department, subDepartment } from "@/database/schema/department-schema";
import { location } from "@/database/schema/location-schema";
import { position } from "@/database/schema/position-schema";
import {
  rosterRequest,
  rosterRequestLine,
  rosterRequestLineDay,
} from "@/database/schema/request-schema";
import type { RequestAccess, RequestActor } from "@/types/requests";
import { formatPoNumber, poPeriod } from "./po-number";
import {
  DAILY_HEADCOUNT_MESSAGE,
  HEADCOUNT_LENGTH_MESSAGE,
  LOCATION_NOT_FOUND_MESSAGE,
  NOT_CANCELLABLE_MESSAGE,
  NOT_EDITABLE_MESSAGE,
  NOT_PENDING_MESSAGE,
  REASON_REQUIRED_MESSAGE,
  REQUEST_NOT_FOUND_MESSAGE,
  siteCodeMissingMessage,
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
};

const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  rows: {
    location: [] as unknown[],
    departments: [] as unknown[],
    subDepartments: [] as unknown[],
    positions: [] as unknown[],
    request: [] as { id: string; status: string }[],
  },
  actor: null as unknown,
  access: null as unknown,
  sequence: 1,
  tx: null as unknown,
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
    if (call.table === rosterRequest) return fake.rows.request;
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
vi.mock("./po-counter", () => ({
  nextPoSequence: async (tx: unknown, siteId: string, period: string) => {
    fake.calls.push({ op: "counter", tx, values: { siteId, period } });
    return fake.sequence;
  },
}));
vi.mock("@/lib/db", () => {
  const tx = { ...query, inTransaction: true };
  fake.tx = tx;

  return {
    db: { ...query, transaction: async (run: (t: typeof tx) => unknown) => run(tx) },
  };
});

const { revalidatePath } = await import("next/cache");
const { createRequest, updateRequest, cancelRequest, approveRequest, rejectRequest } =
  await import("./actions");

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";
const DEPT_A = "55555555-5555-4555-8555-555555555555";
const DEPT_B = "66666666-6666-4666-8666-666666666666";
const SUB_A = "77777777-7777-4777-8777-777777777777";
const POSITION_A = "88888888-8888-4888-8888-888888888888";
const POSITION_B = "99999999-9999-4999-8999-999999999999";
const REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type Role = { actor: RequestActor; access: RequestAccess };

const superadmin: Role = {
  actor: { id: "super-1", name: "Super", role: "superadmin", siteId: null, locationId: null },
  access: { siteId: null, locationId: null },
};
const hoA: Role = {
  actor: { id: "ho-a", name: "HO A", role: "ho", siteId: SITE_A, locationId: null },
  access: { siteId: SITE_A, locationId: null },
};
const hoB: Role = {
  actor: { id: "ho-b", name: "HO B", role: "ho", siteId: SITE_B, locationId: null },
  access: { siteId: SITE_B, locationId: null },
};
const adminA: Role = {
  actor: { id: "admin-a", name: "Admin A", role: "admin_site", siteId: null, locationId: LOCATION_A },
  access: { siteId: SITE_A, locationId: LOCATION_A },
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

function seedLocationChoices() {
  fake.rows.location = [{ id: LOCATION_A, siteId: SITE_A, siteName: "Nestle Kejayan", siteCode: "NSL" }];
  fake.rows.departments = [{ id: DEPT_A }];
  fake.rows.subDepartments = [{ id: SUB_A, departmentId: DEPT_A }];
  fake.rows.positions = [{ id: POSITION_A }];
}

function storedRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    type: "weekly",
    status: "pending",
    startDate: FUTURE,
    siteId: SITE_A,
    locationId: LOCATION_A,
    ...overrides,
  };
}

const writes = () =>
  fake.calls.filter((call) => call.op !== "select" && call.op !== "counter");
const counterCalls = () => fake.calls.filter((call) => call.op === "counter");
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
  fake.rows = { location: [], departments: [], subDepartments: [], positions: [], request: [] };
  fake.sequence = 1;
  actAs(superadmin);
  vi.mocked(revalidatePath).mockClear();
});

describe("request actions module", () => {
  it("opens with the use server directive so client components can call it", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

    expect(source.split("\n")[0].trim()).toBe('"use server";');
  });
});

describe("createRequest", () => {
  it("creates a daily request as approved with the next PO number, then its lines", async () => {
    actAs(adminA);
    seedLocationChoices();
    const period = poPeriod(new Date(), "Asia/Jakarta");

    const res = await createRequest(createInput);

    expect(res).toEqual({ ok: true, id: "request-new", poNumber: `PO-NSL-${period}-0001` });

    const locked = fake.calls.find((c) => c.op === "select" && c.table === location);
    expect(locked?.lock).toBe("share");

    expect(counterCalls()).toEqual([
      { op: "counter", tx: fake.tx, values: { siteId: SITE_A, period } },
    ]);

    expect(writes().map((c) => c.table)).toEqual([
      rosterRequest,
      rosterRequestLine,
      rosterRequestLineDay,
    ]);
    expect(writes()[0].values).toEqual({
      poNumber: `PO-NSL-${period}-0001`,
      type: "daily",
      startDate: FUTURE,
      siteId: SITE_A,
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
      poNumber: formatPoNumber("NSL", poPeriod(new Date(), "Asia/Jakarta"), 12),
    });
    expect(writes()[0].values).toMatchObject({ type: "weekly", status: "pending" });
  });

  it("refuses a site without a code and writes nothing", async () => {
    seedLocationChoices();
    fake.rows.location = [
      { id: LOCATION_A, siteId: SITE_A, siteName: "Nestle Kejayan", siteCode: null },
    ];

    const res = await createRequest(createInput);

    expect(res).toEqual({ ok: false, formError: siteCodeMissingMessage("Nestle Kejayan") });
    expect(res.ok === false && res.formError).toContain("Nestle Kejayan");
    expect(writes()).toEqual([]);
    expect(counterCalls()).toEqual([]);
  });

  it("refuses an empty site code and writes nothing", async () => {
    seedLocationChoices();
    fake.rows.location = [
      { id: LOCATION_A, siteId: SITE_A, siteName: "Nestle Kejayan", siteCode: "" },
    ];

    const res = await createRequest(createInput);

    expect(res).toEqual({ ok: false, formError: siteCodeMissingMessage("Nestle Kejayan") });
    expect(res.ok === false && res.formError).toContain("Nestle Kejayan");
    expect(writes()).toEqual([]);
  });

  it("refuses a location outside the actor's access and writes nothing", async () => {
    actAs(adminA);
    seedLocationChoices();
    fake.rows.location = [{ id: LOCATION_B, siteId: SITE_A, siteCode: "NSL" }];

    const res = await createRequest({ ...createInput, locationId: LOCATION_B });

    expect(res).toEqual({ ok: false, formError: LOCATION_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
    expect(counterCalls()).toEqual([]);
  });

  it("refuses a location in another site for HO and writes nothing", async () => {
    actAs(hoB);
    seedLocationChoices();

    const res = await createRequest(createInput);

    expect(res).toEqual({ ok: false, formError: LOCATION_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
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

  it("refuses a position from another site and inserts nothing", async () => {
    seedLocationChoices();

    const res = await createRequest({
      ...createInput,
      lines: [{ ...line, positionId: POSITION_B }],
    });

    expect(res).toEqual({ ok: false, fieldErrors: { lines: "Choose a position from this site" } });
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

describe("updateRequest", () => {
  it("sends an approved weekly back to pending and clears the decision", async () => {
    actAs(hoA);
    seedLocationChoices();
    fake.rows.request = [storedRequest({ status: "approved" })];

    const res = await updateRequest(REQUEST_ID, updateInput);

    expect(res).toEqual({ ok: true });
    const locked = fake.calls.find((c) => c.op === "select" && c.table === rosterRequest);
    expect(locked?.lock).toBe("update");
    expect(whereParams(locked?.where)).toEqual([REQUEST_ID, SITE_A]);

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
      updatedBy: "super-1",
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

  it("returns not found for HO of another site even when the row is read", async () => {
    actAs(hoB);
    fake.rows.request = [storedRequest()];

    const res = await approveRequest(REQUEST_ID);

    expect(res).toEqual({ ok: false, formError: REQUEST_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("returns not found for a request outside the scope and issues no update", async () => {
    actAs(hoB);

    const res = await approveRequest(REQUEST_ID);

    expect(res).toEqual({ ok: false, formError: REQUEST_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
    const read = fake.calls.find((c) => c.op === "select" && c.table === rosterRequest);
    expect(whereParams(read?.where)).toEqual([REQUEST_ID, SITE_B]);
  });

  it.each([
    ["HO of the same site", hoA],
    ["superadmin", superadmin],
  ])("lets %s approve a pending request", async (_label, role) => {
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

  it("returns not found for admin site and HO of another site and issues no update", async () => {
    fake.rows.request = [storedRequest()];

    for (const role of [adminA, hoB]) {
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
