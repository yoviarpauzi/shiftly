import { APIError } from "better-auth/api";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { location } from "@/database/schema/location-schema";
import { workRule } from "@/database/schema/work-rule-schema";
import type { SettingsAccess } from "@/types/settings";
import {
  INCORRECT_PASSWORD_MESSAGE,
  LOCATION_NOT_FOUND_MESSAGE,
  READ_ONLY_MESSAGE,
} from "./settings-rules";

// The database is replaced by a recorder. Every query is logged as a Call, and the result of a
// read comes from `rows`, keyed by the table it reads. The recorder cannot run a WHERE clause, so
// a missing or deleted target is simulated by leaving its rows empty.
type Call = {
  op: "select" | "insert";
  table?: unknown;
  values?: unknown;
  conflict?: { target: unknown; targetWhere: SQL; set: Record<string, unknown> };
  lock?: string;
  where?: SQL;
  join?: unknown;
};

const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  rows: { location: [] as unknown[] },
  access: null as unknown,
  changePassword: vi.fn(),
  revalidatePath: vi.fn(),
  headers: new Headers({ cookie: "session=abc" }),
}));

function result(call: Call): unknown {
  if (call.op === "select") {
    if (call.table === location) return fake.rows.location;
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
    innerJoin(table: unknown) {
      call.join = table;
      return chain;
    },
    where(condition: SQL) {
      call.where = condition;
      return chain;
    },
    for(strength: string) {
      call.lock = strength;
      return chain;
    },
    values(values: unknown) {
      call.values = values;
      return chain;
    },
    onConflictDoUpdate(config: Call["conflict"]) {
      call.conflict = config;
      return chain;
    },
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      return new Promise((done) => done(result(call))).then(resolve, reject);
    },
  };

  return chain;
}

const tx = {
  select: () => builder({ op: "select" }),
  insert: (table: unknown) => builder({ op: "insert", table }),
};

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: fake.revalidatePath }));
vi.mock("next/headers", () => ({ headers: async () => fake.headers }));
vi.mock("@/lib/session", () => ({ requireUser: async () => ({ id: "user-1" }) }));
vi.mock("@/lib/auth", () => ({ auth: { api: { changePassword: fake.changePassword } } }));
vi.mock("./settings-guard", () => ({
  requireSettingsAccess: async () => fake.access,
}));
vi.mock("@/lib/db", () => ({
  db: { ...tx, transaction: async (run: (t: typeof tx) => unknown) => run(tx) },
}));

const {
  changePassword,
  updateWorkRuleAnnualOff,
  updateWorkRuleBreak,
  updateWorkRuleMaxWorkingDays,
  updateWorkRulePlacement,
  updateWorkRuleQualification,
  updateWorkRuleShiftChange,
  updateWorkRuleWorkDays,
} = await import("./actions");

const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";

const HO: SettingsAccess = { userId: "user-2", role: "ho", locationId: null };
const ADMIN_SITE: SettingsAccess = {
  userId: "user-3",
  role: "admin_site",
  locationId: LOCATION_A,
};

const GLOBAL = { scope: "global" } as const;
const atLocation = (locationId: string) => ({ scope: "location", locationId }) as const;

const dialect = new PgDialect();
const writes = () => fake.calls.filter((call) => call.op !== "select");
const render = (query: SQL | undefined) => dialect.sqlToQuery(query!);

// The existence check is the only thing that turns a deleted or unknown target into "not found",
// so its filters are asserted as SQL, not just through the rows the recorder hands back.
const expectLocationCheck = (locationId: string) => {
  const [check] = fake.calls;

  expect(check).toMatchObject({ op: "select", table: location, lock: "share" });
  expect(check.join).toBeUndefined();
  expect(render(check.where)).toMatchObject({
    sql: '("location"."id" = $1 and "location"."deleted_at" is null)',
    params: [locationId],
  });
};

beforeEach(() => {
  fake.calls = [];
  fake.rows = { location: [{ id: LOCATION_A }] };
  fake.access = HO;
  fake.changePassword.mockReset();
  fake.revalidatePath.mockReset();
});

describe("changePassword", () => {
  const valid = {
    currentPassword: "old-password",
    newPassword: "new-password",
    confirmPassword: "new-password",
  };

  it("changes the password and always revokes the other sessions", async () => {
    fake.changePassword.mockResolvedValue({ token: "t", user: {} });

    const result = await changePassword(valid);

    expect(result).toEqual({ ok: true });
    expect(fake.changePassword).toHaveBeenCalledTimes(1);
    expect(fake.changePassword).toHaveBeenCalledWith({
      body: {
        currentPassword: "old-password",
        newPassword: "new-password",
        revokeOtherSessions: true,
      },
      headers: fake.headers,
    });
  });

  it("ignores a revokeOtherSessions value sent by the client", async () => {
    fake.changePassword.mockResolvedValue({ token: "t", user: {} });

    await changePassword({ ...valid, revokeOtherSessions: false } as typeof valid);

    expect(fake.changePassword.mock.calls[0][0].body).toEqual({
      currentPassword: "old-password",
      newPassword: "new-password",
      revokeOtherSessions: true,
    });
  });

  it.each([
    {
      label: "a confirm mismatch",
      input: { ...valid, confirmPassword: "something-else" },
      field: "confirmPassword",
      message: "Passwords do not match",
    },
    {
      label: "a new password equal to the current one",
      input: { ...valid, newPassword: "old-password", confirmPassword: "old-password" },
      field: "newPassword",
      message: "New password must be different from the current one",
    },
    {
      label: "a 129-character new password",
      input: { ...valid, newPassword: "a".repeat(129), confirmPassword: "a".repeat(129) },
      field: "newPassword",
      message: "Password must be 128 characters or fewer",
    },
    {
      label: "a 129-character current password",
      input: { ...valid, currentPassword: "a".repeat(129) },
      field: "currentPassword",
      message: "Password must be 128 characters or fewer",
    },
  ])("refuses $label without calling better-auth", async ({ input, field, message }) => {
    const result = await changePassword(input);

    expect(result).toEqual({ ok: false, fieldErrors: { [field]: message } });
    expect(fake.changePassword).not.toHaveBeenCalled();
  });

  it("reports a wrong current password on that field", async () => {
    fake.changePassword.mockRejectedValue(
      new APIError("BAD_REQUEST", { code: "INVALID_PASSWORD", message: "Invalid password" }),
    );

    const result = await changePassword(valid);

    expect(result).toEqual({
      ok: false,
      fieldErrors: { currentPassword: INCORRECT_PASSWORD_MESSAGE },
    });
  });

  it("rethrows any other better-auth error", async () => {
    const error = new APIError("UNAUTHORIZED", { code: "UNAUTHORIZED", message: "No session" });
    fake.changePassword.mockRejectedValue(error);

    await expect(changePassword(valid)).rejects.toBe(error);
  });

  it("rethrows an error that is not from better-auth", async () => {
    const error = new Error("connection lost");
    fake.changePassword.mockRejectedValue(error);

    await expect(changePassword(valid)).rejects.toBe(error);
  });
});

type Action = (input: never) => Promise<unknown>;

// [name, action, valid values, an invalid value for the same card]. The valid values are also the
// exact columns the action must write: nothing from another card.
const CARDS: [string, Action, Record<string, unknown>, Record<string, unknown>][] = [
  ["updateWorkRuleWorkDays", updateWorkRuleWorkDays, { workDaysPerWeek: 7 }, { workDaysPerWeek: 6 }],
  [
    "updateWorkRuleBreak",
    updateWorkRuleBreak,
    { breakDays: 5, breakCycleMonths: 2 },
    { breakDays: 0, breakCycleMonths: 2 },
  ],
  ["updateWorkRuleAnnualOff", updateWorkRuleAnnualOff, { annualOffDays: 12 }, { annualOffDays: 367 }],
  [
    "updateWorkRuleShiftChange",
    updateWorkRuleShiftChange,
    { shiftExceptionDays: 10 },
    { shiftExceptionDays: 31 },
  ],
  [
    "updateWorkRuleQualification",
    updateWorkRuleQualification,
    { requirePositionMatch: false },
    { requirePositionMatch: "yes" },
  ],
  [
    "updateWorkRulePlacement",
    updateWorkRulePlacement,
    { keepPreviousPlacement: true },
    { keepPreviousPlacement: "yes" },
  ],
  [
    "updateWorkRuleMaxWorkingDays",
    updateWorkRuleMaxWorkingDays,
    { maxWorkingDaysPerMonth: 22 },
    { maxWorkingDaysPerMonth: 32 },
  ],
];

describe.each(CARDS)("%s", (_name, action, values, invalid) => {
  const save = (target: unknown, fields: Record<string, unknown> = values) =>
    action({ target, ...fields } as never);

  const nulls = Object.fromEntries(Object.keys(values).map((key) => [key, null]));

  const expectUpsert = (
    ids: Record<string, string>,
    columns: Record<string, unknown>,
    userId: string,
    conflictColumn: unknown,
    where: string,
  ) => {
    const [insert, ...rest] = writes();

    expect(rest).toEqual([]);
    expect(insert.table).toBe(workRule);
    expect(insert.values).toEqual({
      ...ids,
      ...columns,
      updatedBy: userId,
      updatedAt: expect.any(Date),
    });
    expect(insert.conflict?.target).toBe(conflictColumn);
    expect(dialect.sqlToQuery(insert.conflict!.targetWhere).sql).toBe(where);
    expect(insert.conflict?.set).toEqual({
      ...columns,
      updatedBy: userId,
      updatedAt: expect.any(Date),
    });
    expect(fake.revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
  };

  const expectRefused = (result: unknown, formError: string) => {
    expect(result).toEqual({ ok: false, formError });
    expect(writes()).toEqual([]);
    expect(fake.revalidatePath).not.toHaveBeenCalled();
  };

  describe("HO", () => {
    it("writes the global row, with no location lookup", async () => {
      expect(await save(GLOBAL)).toEqual({ ok: true });
      expect(fake.calls.filter((call) => call.op === "select")).toEqual([]);
      expectUpsert({ scope: "global" }, values, "user-2", workRule.scope, "scope = 'global'");
    });

    it("writes a location, locking it against a delete", async () => {
      expect(await save(atLocation(LOCATION_A))).toEqual({ ok: true });
      expectLocationCheck(LOCATION_A);
      expectUpsert(
        { scope: "location", locationId: LOCATION_A },
        values,
        "user-2",
        workRule.locationId,
        "scope = 'location'",
      );
    });

    it("writes any other location too", async () => {
      fake.rows.location = [{ id: LOCATION_B }];

      expect(await save(atLocation(LOCATION_B))).toEqual({ ok: true });
      expectLocationCheck(LOCATION_B);
      expectUpsert(
        { scope: "location", locationId: LOCATION_B },
        values,
        "user-2",
        workRule.locationId,
        "scope = 'location'",
      );
    });
  });

  describe("admin site", () => {
    beforeEach(() => {
      fake.access = ADMIN_SITE;
    });

    it("writes its own location", async () => {
      expect(await save(atLocation(LOCATION_A))).toEqual({ ok: true });
      expectUpsert(
        { scope: "location", locationId: LOCATION_A },
        values,
        "user-3",
        workRule.locationId,
        "scope = 'location'",
      );
    });

    it("is refused at global scope", async () => {
      expectRefused(await save(GLOBAL), READ_ONLY_MESSAGE);
    });

    it("is refused on another location", async () => {
      fake.rows.location = [{ id: LOCATION_B }];

      expectRefused(await save(atLocation(LOCATION_B)), LOCATION_NOT_FOUND_MESSAGE);
    });
  });

  it("refuses a location that is deleted or missing", async () => {
    fake.rows.location = [];

    expectRefused(await save(atLocation(LOCATION_A)), LOCATION_NOT_FOUND_MESSAGE);
    expectLocationCheck(LOCATION_A);
  });

  it("refuses a site target, a level that no longer exists, before reading anything", async () => {
    const result = await save({ scope: "site", siteId: LOCATION_A });

    expect(result).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(writes()).toEqual([]);
    expect(fake.calls).toEqual([]);
  });

  it.each([
    { label: "location", target: atLocation(LOCATION_A), message: LOCATION_NOT_FOUND_MESSAGE },
    { label: "global", target: GLOBAL, message: READ_ONLY_MESSAGE },
  ])("answers a caller with no access at $label scope with a refusal", async ({ target, message }) => {
    fake.access = null;

    expectRefused(await save(target), message);
    expect(fake.calls).toEqual([]);
  });

  it("decides from the parsed target, not from a flag sent by the client", async () => {
    fake.access = ADMIN_SITE;
    fake.rows.location = [{ id: LOCATION_B }];

    const result = await action({
      target: atLocation(LOCATION_B),
      ...values,
      canEdit: true,
      role: "ho",
      locationId: LOCATION_B,
    } as never);

    expectRefused(result, LOCATION_NOT_FOUND_MESSAGE);
  });

  it("refuses an invalid value before reading anything", async () => {
    const result = await save(atLocation(LOCATION_A), invalid);

    expect(result).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(fake.calls).toEqual([]);
  });

  it("refuses a global target that carries a location id before reading anything", async () => {
    const result = await save({ scope: "global", locationId: LOCATION_A });

    expect(result).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(fake.calls).toEqual([]);
  });

  it("writes null for exactly this card's columns on Use inherited", async () => {
    expect(await save(atLocation(LOCATION_A), nulls)).toEqual({ ok: true });
    expectUpsert(
      { scope: "location", locationId: LOCATION_A },
      nulls,
      "user-2",
      workRule.locationId,
      "scope = 'location'",
    );
  });

  it("refuses Use inherited at global scope before reading anything", async () => {
    const result = await save(GLOBAL, nulls);

    expect(result).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(fake.calls).toEqual([]);
  });
});
