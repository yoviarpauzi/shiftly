import { readFileSync } from "node:fs";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INVALID_TIMEZONE_MESSAGE,
  LOCATION_NOT_FOUND_MESSAGE,
  siteCodeMissingMessage,
} from "@/app/dashboard/requests/request-rules";
import { attendance } from "@/database/schema/attendance-schema";
import { billing, billingAttendance, billingLine } from "@/database/schema/billing-schema";
import { location } from "@/database/schema/location-schema";
import type { BillableDay } from "@/types/billings";
import type { RequestAccess, RequestActor } from "@/types/requests";
import {
  BILLING_NOT_FOUND_MESSAGE,
  CLAIM_COLLISION_MESSAGE,
  NOT_DRAFT_MESSAGE,
  NOT_ISSUED_MESSAGE,
  NOTHING_TO_BILL_MESSAGE,
  STALE_BILLING_MESSAGE,
} from "./billing-rules";

// The database is replaced by a recorder, as in app/dashboard/attendance/actions.test.ts. Every
// query is a Call. A select returns the rows seeded for its table: `fake.rows.location` for the
// location (joined to its site), `fake.rows.billing` for the billing, and `fake.rows.attendance`
// for the billable days. The recorder cannot run a WHERE clause, so scope and soft deletes are
// simulated by which rows the test seeds.
type Call = {
  op: "select" | "insert" | "delete" | "update" | "execute";
  table?: unknown;
  values?: unknown;
  set?: Record<string, unknown>;
  lock?: { strength: string; of?: unknown };
  where?: SQL;
  inTransaction: boolean;
};

const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  rows: {
    location: [] as Record<string, unknown>[],
    billing: [] as Record<string, unknown>[],
    attendance: [] as Record<string, unknown>[],
  },
  session: null as unknown,
  // An insert into this table rejects with this error, as a unique violation would.
  failInsert: null as { table: unknown; error: unknown } | null,
  rolledBack: false,
}));

const dialect = new PgDialect();

function whereParams(where: SQL | undefined): unknown[] {
  return where ? dialect.sqlToQuery(where).params : [];
}

function selectRows(table: unknown): unknown[] {
  if (table === location) return fake.rows.location;
  if (table === billing) return fake.rows.billing;
  if (table === attendance) return fake.rows.attendance;

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
    orderBy: () => chain,
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
    set(values: Record<string, unknown>) {
      call.set = values;
      return chain;
    },
    returning: () => chain,
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      if (call.op === "insert" && fake.failInsert && fake.failInsert.table === call.table) {
        return Promise.reject(fake.failInsert.error).then(resolve, reject);
      }

      const rows =
        call.op === "select"
          ? selectRows(call.table)
          : call.op === "insert" && call.table === billing
            ? [{ id: NEW_BILLING }]
            : [];

      return Promise.resolve(rows).then(resolve, reject);
    },
  };

  return chain;
}

function queries(inTransaction: boolean) {
  return {
    select: () => builder({ op: "select", inTransaction }),
    insert: (table: unknown) => builder({ op: "insert", table, inTransaction }),
    delete: (table: unknown) => builder({ op: "delete", table, inTransaction }),
    update: (table: unknown) => builder({ op: "update", table, inTransaction }),
    // The billing counter upsert.
    execute: async (query: unknown) => {
      fake.calls.push({ op: "execute", values: query, inTransaction });
      return { rows: [{ last_value: 1 }] };
    },
  };
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./billing-guard", () => ({
  requireBillingUser: async () => fake.session,
}));
vi.mock("@/lib/db", () => ({
  db: {
    ...queries(false),
    // A rejection from the callback is what rolls a real transaction back, so it is recorded here.
    transaction: async (run: (tx: unknown) => unknown) => {
      try {
        return await run(queries(true));
      } catch (error) {
        fake.rolledBack = true;
        throw error;
      }
    },
  },
}));

const { revalidatePath } = await import("next/cache");
const { createBilling, deleteBilling, issueBilling, updateBillingPeriod, voidBilling } =
  await import("./actions");

const NEW_BILLING = "b0000000-0000-4000-8000-0000000000aa";
const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_A2 = "44444444-4444-4444-8444-444444444444";
const BILLING_1 = "b0000000-0000-4000-8000-000000000001";
const REQUEST_1 = "c0000000-0000-4000-8000-000000000001";
const DEPARTMENT_1 = "d0000000-0000-4000-8000-000000000001";
const POSITION_1 = "e0000000-0000-4000-8000-000000000001";
const POSITION_2 = "e0000000-0000-4000-8000-000000000002";
const ATTENDANCE_1 = "f0000000-0000-4000-8000-000000000001";
const ATTENDANCE_2 = "f0000000-0000-4000-8000-000000000002";
const ATTENDANCE_3 = "f0000000-0000-4000-8000-000000000003";
const UPDATED_AT = new Date("2026-11-10T03:00:00.000Z");
const VERSION = UPDATED_AT.toISOString();

const session = (user: Partial<RequestActor>, access: RequestAccess) => ({
  user: { id: "user-1", name: "User", role: "superadmin", siteId: null, locationId: null, ...user },
  access,
});

const superadmin = session({}, { siteId: null, locationId: null });
const hoB = session({ id: "ho-b", role: "ho", siteId: SITE_B }, { siteId: SITE_B, locationId: null });
const adminA = session(
  { id: "admin-a", role: "admin_site", siteId: SITE_A, locationId: LOCATION_A },
  { siteId: SITE_A, locationId: LOCATION_A },
);
const adminOther = session(
  { id: "admin-o", role: "admin_site", siteId: SITE_A, locationId: LOCATION_A2 },
  { siteId: SITE_A, locationId: LOCATION_A2 },
);

const locationRow = (overrides: Record<string, unknown> = {}) => ({
  id: LOCATION_A,
  siteId: SITE_A,
  siteName: "Jakarta",
  siteCode: "JKT",
  timezone: "Asia/Jakarta",
  ...overrides,
});

const billingRow = (overrides: Record<string, unknown> = {}) => ({
  id: BILLING_1,
  status: "draft",
  siteId: SITE_A,
  locationId: LOCATION_A,
  periodStart: "2026-11-01",
  periodEnd: "2026-11-30",
  updatedAt: UPDATED_AT,
  ...overrides,
});

const day = (attendanceId: string, positionId: string, positionName: string): BillableDay => ({
  attendanceId,
  requestId: REQUEST_1,
  poNumber: "PO-JKT-202611-0001",
  departmentId: DEPARTMENT_1,
  departmentName: "Warehouse",
  subDepartmentId: null,
  subDepartmentName: null,
  positionId,
  positionName,
});

const writes = () => fake.calls.filter((call) => call.op !== "select");
const inserts = (table: unknown) =>
  fake.calls.filter((call) => call.op === "insert" && call.table === table);
const counterCalls = () => fake.calls.filter((call) => call.op === "execute");

beforeEach(() => {
  fake.calls = [];
  fake.rows = {
    location: [locationRow()],
    billing: [billingRow()],
    attendance: [
      day(ATTENDANCE_1, POSITION_1, "Picker"),
      day(ATTENDANCE_2, POSITION_1, "Picker"),
      day(ATTENDANCE_3, POSITION_2, "Packer"),
    ],
  };
  fake.session = superadmin;
  fake.failInsert = null;
  fake.rolledBack = false;
  vi.mocked(revalidatePath).mockClear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-19T05:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("billing actions module", () => {
  it("opens with the use server directive so client components can call it", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

    expect(source.split("\n")[0].trim()).toBe('"use server";');
  });
});

describe("createBilling", () => {
  const monthly = { locationId: LOCATION_A, period: { mode: "monthly", month: "2026-11" } } as const;

  it("creates a draft for an admin site's own location", async () => {
    fake.session = adminA;

    const res = await createBilling(monthly);

    expect(res).toEqual({ ok: true, id: NEW_BILLING });

    const [lock] = fake.calls.filter((call) => call.op === "select");

    expect(lock.table).toBe(location);
    expect(lock.lock?.strength).toBe("share");

    const created = inserts(billing);

    expect(created).toHaveLength(1);
    expect(created[0].inTransaction).toBe(true);
    expect(created[0].values).toEqual({
      siteId: SITE_A,
      locationId: LOCATION_A,
      mode: "monthly",
      status: "draft",
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      createdBy: "admin-a",
    });
    expect(created[0].values).not.toHaveProperty("number");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/billings");
  });

  it("refuses a location outside the access", async () => {
    fake.session = adminOther;

    const res = await createBilling(monthly);

    expect(res).toEqual({ ok: false, formError: LOCATION_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a location of another site for an HO", async () => {
    fake.session = hoB;

    const res = await createBilling(monthly);

    expect(res).toEqual({ ok: false, formError: LOCATION_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("refuses a soft-deleted location", async () => {
    fake.rows.location = [];

    const res = await createBilling(monthly);

    expect(res).toEqual({ ok: false, formError: LOCATION_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("refuses a custom period whose start is after its end, before any query", async () => {
    const res = await createBilling({
      locationId: LOCATION_A,
      period: { mode: "custom", from: "2026-11-30", to: "2026-11-01" },
    });

    expect(res).toEqual({ ok: false, formError: "Choose a valid period" });
    expect(fake.calls).toEqual([]);
  });

  it("refuses a malformed location id before any query", async () => {
    const res = await createBilling({ ...monthly, locationId: "not-a-uuid" });

    expect(res.ok).toBe(false);
    expect(fake.calls).toEqual([]);
  });
});

describe("updateBillingPeriod", () => {
  const input = (version = VERSION) => ({
    billingId: BILLING_1,
    version,
    period: { mode: "weekly", date: "2026-11-19" } as const,
  });

  it("sets the new period and mode on a draft", async () => {
    const res = await updateBillingPeriod(input());

    expect(res).toEqual({ ok: true, id: BILLING_1 });

    const [lock] = fake.calls.filter((call) => call.op === "select");

    expect(lock.table).toBe(billing);
    expect(lock.lock?.strength).toBe("update");

    const [update] = writes();

    expect(update.op).toBe("update");
    expect(update.table).toBe(billing);
    expect(update.inTransaction).toBe(true);
    expect(update.set).toEqual({
      mode: "weekly",
      periodStart: "2026-11-16",
      periodEnd: "2026-11-22",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/billings");
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/billings/${BILLING_1}`);
  });

  it("refuses an issued billing", async () => {
    fake.rows.billing = [billingRow({ status: "issued" })];

    expect(await updateBillingPeriod(input())).toEqual({ ok: false, formError: NOT_DRAFT_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("refuses a stale version", async () => {
    const res = await updateBillingPeriod(input("2026-11-01T00:00:00.000Z"));

    expect(res).toEqual({ ok: false, formError: STALE_BILLING_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("answers not found for a billing outside the scope", async () => {
    fake.session = adminOther;

    const res = await updateBillingPeriod(input());

    expect(res).toEqual({ ok: false, formError: BILLING_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });
});

describe("deleteBilling", () => {
  it("deletes a draft", async () => {
    const res = await deleteBilling({ billingId: BILLING_1 });

    expect(res).toEqual({ ok: true, id: BILLING_1 });

    const [lock] = fake.calls.filter((call) => call.op === "select");

    expect(lock.lock?.strength).toBe("update");

    const [remove] = writes();

    expect(remove.op).toBe("delete");
    expect(remove.table).toBe(billing);
    expect(whereParams(remove.where)).toEqual([BILLING_1]);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/billings");
  });

  it("refuses an issued billing", async () => {
    fake.rows.billing = [billingRow({ status: "issued" })];

    const res = await deleteBilling({ billingId: BILLING_1 });

    expect(res).toEqual({ ok: false, formError: NOT_DRAFT_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("refuses a malformed id before any query", async () => {
    const res = await deleteBilling({ billingId: "nope" });

    expect(res.ok).toBe(false);
    expect(fake.calls).toEqual([]);
  });
});

describe("issueBilling", () => {
  const input = (version = VERSION) => ({ billingId: BILLING_1, version });

  it("numbers the billing, writes the lines and the claims, and sets it issued", async () => {
    fake.session = adminA;

    const res = await issueBilling(input());

    expect(res).toEqual({ ok: true, id: BILLING_1 });
    expect(fake.calls.every((call) => call.inTransaction)).toBe(true);

    const [billingLock, locationLock, daySelect] = fake.calls.filter(
      (call) => call.op === "select",
    );

    expect(billingLock.table).toBe(billing);
    expect(billingLock.lock?.strength).toBe("update");
    expect(locationLock.table).toBe(location);
    expect(locationLock.lock?.strength).toBe("share");
    expect(daySelect.table).toBe(attendance);
    expect(daySelect.lock).toMatchObject({ strength: "update" });

    expect(counterCalls()).toHaveLength(1);

    const lines = inserts(billingLine);

    expect(lines).toHaveLength(1);

    const lineRows = lines[0].values as { billingId: string; days: number; positionName: string }[];

    expect(lineRows).toHaveLength(2);
    expect(lineRows.reduce((sum, line) => sum + line.days, 0)).toBe(3);
    expect(lineRows.every((line) => line.billingId === BILLING_1)).toBe(true);
    expect(lineRows.map((line) => line.positionName).sort()).toEqual(["Packer", "Picker"]);

    const claims = inserts(billingAttendance);

    expect(claims).toHaveLength(1);
    expect(claims[0].values).toEqual([
      { billingId: BILLING_1, attendanceId: ATTENDANCE_1 },
      { billingId: BILLING_1, attendanceId: ATTENDANCE_2 },
      { billingId: BILLING_1, attendanceId: ATTENDANCE_3 },
    ]);

    const updates = fake.calls.filter((call) => call.op === "update");

    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe(billing);
    expect(updates[0].set?.status).toBe("issued");
    expect(updates[0].set?.number).toMatch(/^BL-JKT-\d{6}-0001$/);
    expect(updates[0].set?.issuedBy).toBe("admin-a");
    expect(updates[0].set?.issuedAt).toBeInstanceOf(Date);

    // The claims follow the lines, and the status changes last.
    const order = writes().map((call) => call.op === "execute" ? "counter" : call.table);

    expect(order).toEqual(["counter", billingLine, billingAttendance, billing]);

    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/billings");
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/billings/${BILLING_1}`);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/attendance");
  });

  it("refuses a period with no billable days without taking a number", async () => {
    fake.rows.attendance = [];

    const res = await issueBilling(input());

    expect(res).toEqual({ ok: false, formError: NOTHING_TO_BILL_MESSAGE });
    expect(counterCalls()).toEqual([]);
    expect(writes()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["at the top", { code: "23505" }],
    ["under cause", { cause: { code: "23505" } }],
  ])("maps a claim collision %s to its message and rolls back", async (_shape, error) => {
    fake.failInsert = { table: billingAttendance, error };

    const res = await issueBilling(input());

    expect(res).toEqual({ ok: false, formError: CLAIM_COLLISION_MESSAGE });
    // The error left the transaction callback, so the transaction, number included, rolled back.
    expect(fake.rolledBack).toBe(true);
    expect(fake.calls.some((call) => call.op === "update")).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rethrows an error that is not a claim collision", async () => {
    const boom = new Error("connection lost");

    fake.failInsert = { table: billingAttendance, error: boom };

    await expect(issueBilling(input())).rejects.toBe(boom);
  });

  it("refuses a soft-deleted location and writes nothing", async () => {
    fake.rows.location = [];

    const res = await issueBilling(input());

    expect(res).toEqual({ ok: false, formError: LOCATION_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("refuses an unknown time zone and writes nothing", async () => {
    fake.rows.location = [locationRow({ timezone: "Mars/Base" })];

    const res = await issueBilling(input());

    expect(res).toEqual({ ok: false, formError: INVALID_TIMEZONE_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("refuses a site without a code and writes nothing", async () => {
    fake.rows.location = [locationRow({ siteCode: null })];

    const res = await issueBilling(input());

    expect(res).toEqual({ ok: false, formError: siteCodeMissingMessage("Jakarta") });
    expect(writes()).toEqual([]);
  });

  it("refuses a billing that is already issued", async () => {
    fake.rows.billing = [billingRow({ status: "issued" })];

    const res = await issueBilling(input());

    expect(res).toEqual({ ok: false, formError: NOT_DRAFT_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("refuses a stale version", async () => {
    const res = await issueBilling(input("2026-11-01T00:00:00.000Z"));

    expect(res).toEqual({ ok: false, formError: STALE_BILLING_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("answers not found for a billing outside the scope", async () => {
    fake.session = adminOther;

    const res = await issueBilling(input());

    expect(res).toEqual({ ok: false, formError: BILLING_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("answers not found for a missing billing", async () => {
    fake.rows.billing = [];

    const res = await issueBilling(input());

    expect(res).toEqual({ ok: false, formError: BILLING_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });
});

describe("voidBilling", () => {
  const input = (reason = "Wrong period", version = VERSION) => ({
    billingId: BILLING_1,
    version,
    reason,
  });

  beforeEach(() => {
    fake.rows.billing = [
      billingRow({ status: "issued", number: "BL-JKT-202611-0001", issuedAt: UPDATED_AT }),
    ];
  });

  it("refuses a blank reason before any query", async () => {
    const res = await voidBilling(input("   "));

    expect(res).toEqual({ ok: false, formError: "A reason is required to void" });
    expect(fake.calls).toEqual([]);
  });

  it("refuses a draft", async () => {
    fake.rows.billing = [billingRow()];

    const res = await voidBilling(input());

    expect(res).toEqual({ ok: false, formError: NOT_ISSUED_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("refuses a stale version", async () => {
    const res = await voidBilling(input("Wrong period", "2026-11-01T00:00:00.000Z"));

    expect(res).toEqual({ ok: false, formError: STALE_BILLING_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("answers not found for a billing outside the scope", async () => {
    fake.session = hoB;

    const res = await voidBilling(input());

    expect(res).toEqual({ ok: false, formError: BILLING_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("frees the claimed days, then sets the billing void with the trimmed reason", async () => {
    fake.session = adminA;

    const res = await voidBilling(input("  Wrong period  "));

    expect(res).toEqual({ ok: true, id: BILLING_1 });

    const [lock] = fake.calls.filter((call) => call.op === "select");

    expect(lock.table).toBe(billing);
    expect(lock.lock?.strength).toBe("update");

    const [remove, update] = writes();

    expect(remove.op).toBe("delete");
    expect(remove.table).toBe(billingAttendance);
    expect(remove.inTransaction).toBe(true);
    expect(whereParams(remove.where)).toEqual([BILLING_1]);

    expect(update.op).toBe("update");
    expect(update.table).toBe(billing);
    expect(update.set).toEqual({
      status: "void",
      voidedBy: "admin-a",
      voidedAt: expect.any(Date),
      voidReason: "Wrong period",
    });
    expect(writes()).toHaveLength(2);

    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/billings");
    expect(revalidatePath).toHaveBeenCalledWith(`/dashboard/billings/${BILLING_1}`);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/attendance");
  });
});
