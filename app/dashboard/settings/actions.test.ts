import { APIError } from "better-auth/api";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { workRule } from "@/database/schema/work-rule-schema";
import type { SettingsAccess } from "@/types/settings";
import {
  INCORRECT_PASSWORD_MESSAGE,
  LOCATION_NOT_FOUND_MESSAGE,
  READ_ONLY_MESSAGE,
  SITE_NOT_FOUND_MESSAGE,
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
  join?: { table: unknown; on: SQL };
};

const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  rows: { site: [] as unknown[], location: [] as unknown[] },
  access: null as unknown,
  changePassword: vi.fn(),
  revalidatePath: vi.fn(),
  headers: new Headers({ cookie: "session=abc" }),
}));

function result(call: Call): unknown {
  if (call.op === "select") {
    if (call.table === site) return fake.rows.site;
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
    innerJoin(table: unknown, on: SQL) {
      call.join = { table, on };
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
  updateWorkRuleQualification,
  updateWorkRuleShiftChange,
  updateWorkRuleWorkDays,
} = await import("./actions");

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";

const SUPERADMIN: SettingsAccess = {
  userId: "user-1",
  role: "superadmin",
  siteId: null,
  locationId: null,
};
const HO: SettingsAccess = { userId: "user-2", role: "ho", siteId: SITE_A, locationId: null };
const ADMIN_SITE: SettingsAccess = {
  userId: "user-3",
  role: "admin_site",
  siteId: SITE_A,
  locationId: LOCATION_A,
};

const GLOBAL = { scope: "global" } as const;
const atSite = (siteId: string) => ({ scope: "site", siteId }) as const;
const atLocation = (locationId: string) => ({ scope: "location", locationId }) as const;

const dialect = new PgDialect();
const writes = () => fake.calls.filter((call) => call.op !== "select");
const render = (query: SQL | undefined) => dialect.sqlToQuery(query!);

// The existence check is the only thing that turns a deleted or unknown target into "not found",
// so its filters are asserted as SQL, not just through the rows the recorder hands back.
const expectSiteCheck = (siteId: string) => {
  const [check] = fake.calls;

  expect(check).toMatchObject({ op: "select", table: site, lock: "share" });
  expect(check.join).toBeUndefined();
  expect(render(check.where)).toMatchObject({
    sql: '("site"."id" = $1 and "site"."deleted_at" is null)',
    params: [siteId],
  });
};

const expectLocationCheck = (locationId: string) => {
  const [check] = fake.calls;

  expect(check).toMatchObject({ op: "select", table: location, lock: "share" });
  expect(check.join?.table).toBe(site);
  expect(render(check.join?.on).sql).toBe('"site"."id" = "location"."site_id"');
  expect(render(check.where)).toMatchObject({
    sql: '("location"."id" = $1 and "location"."deleted_at" is null and "site"."deleted_at" is null)',
    params: [locationId],
  });
};

beforeEach(() => {
  fake.calls = [];
  fake.rows = { site: [{ id: SITE_A }], location: [{ id: LOCATION_A, siteId: SITE_A }] };
  fake.access = SUPERADMIN;
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

  describe("superadmin", () => {
    it("writes the global row", async () => {
      expect(await save(GLOBAL)).toEqual({ ok: true });
      expect(fake.calls.filter((call) => call.op === "select")).toEqual([]);
      expectUpsert({ scope: "global" }, values, "user-1", workRule.scope, "scope = 'global'");
    });

    it("writes any site, locking it against a delete", async () => {
      fake.rows.site = [{ id: SITE_B }];

      expect(await save(atSite(SITE_B))).toEqual({ ok: true });
      expectSiteCheck(SITE_B);
      expectUpsert(
        { scope: "site", siteId: SITE_B },
        values,
        "user-1",
        workRule.siteId,
        "scope = 'site'",
      );
    });

    it("writes any location, locking it against a delete", async () => {
      fake.rows.location = [{ id: LOCATION_B, siteId: SITE_B }];

      expect(await save(atLocation(LOCATION_B))).toEqual({ ok: true });
      expectLocationCheck(LOCATION_B);
      expectUpsert(
        { scope: "location", locationId: LOCATION_B },
        values,
        "user-1",
        workRule.locationId,
        "scope = 'location'",
      );
    });
  });

  describe("HO", () => {
    beforeEach(() => {
      fake.access = HO;
    });

    it("writes its own site", async () => {
      expect(await save(atSite(SITE_A))).toEqual({ ok: true });
      expectUpsert(
        { scope: "site", siteId: SITE_A },
        values,
        "user-2",
        workRule.siteId,
        "scope = 'site'",
      );
    });

    it("writes a location of its own site", async () => {
      expect(await save(atLocation(LOCATION_A))).toEqual({ ok: true });
      expectUpsert(
        { scope: "location", locationId: LOCATION_A },
        values,
        "user-2",
        workRule.locationId,
        "scope = 'location'",
      );
    });

    it("is refused at global scope", async () => {
      expectRefused(await save(GLOBAL), READ_ONLY_MESSAGE);
    });

    it("is refused on another site", async () => {
      fake.rows.site = [{ id: SITE_B }];

      expectRefused(await save(atSite(SITE_B)), SITE_NOT_FOUND_MESSAGE);
    });

    it("is refused on a location of another site", async () => {
      fake.rows.location = [{ id: LOCATION_B, siteId: SITE_B }];

      expectRefused(await save(atLocation(LOCATION_B)), LOCATION_NOT_FOUND_MESSAGE);
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

    it("is refused at its own site", async () => {
      expectRefused(await save(atSite(SITE_A)), READ_ONLY_MESSAGE);
    });

    it("is refused at global scope", async () => {
      expectRefused(await save(GLOBAL), READ_ONLY_MESSAGE);
    });

    it("is refused on another site", async () => {
      fake.rows.site = [{ id: SITE_B }];

      expectRefused(await save(atSite(SITE_B)), SITE_NOT_FOUND_MESSAGE);
    });

    it("is refused on another location of its own site", async () => {
      fake.rows.location = [{ id: LOCATION_B, siteId: SITE_A }];

      expectRefused(await save(atLocation(LOCATION_B)), LOCATION_NOT_FOUND_MESSAGE);
    });
  });

  it("refuses a site that is deleted or missing", async () => {
    fake.rows.site = [];

    expectRefused(await save(atSite(SITE_A)), SITE_NOT_FOUND_MESSAGE);
    expectSiteCheck(SITE_A);
  });

  it("refuses a location that is deleted, missing, or in a deleted site", async () => {
    fake.rows.location = [];

    expectRefused(await save(atLocation(LOCATION_A)), LOCATION_NOT_FOUND_MESSAGE);
    expectLocationCheck(LOCATION_A);
  });

  it.each([
    { label: "site", target: atSite(SITE_A), message: SITE_NOT_FOUND_MESSAGE },
    { label: "location", target: atLocation(LOCATION_A), message: LOCATION_NOT_FOUND_MESSAGE },
    { label: "global", target: GLOBAL, message: SITE_NOT_FOUND_MESSAGE },
  ])("answers a caller with no access at $label scope with not found", async ({ target, message }) => {
    fake.access = null;

    expectRefused(await save(target), message);
    expect(fake.calls).toEqual([]);
  });

  it("refuses an invalid value before reading anything", async () => {
    const result = await save(atLocation(LOCATION_A), invalid);

    expect(result).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(fake.calls).toEqual([]);
  });

  it("refuses a site target that carries a location id before reading anything", async () => {
    const result = await save({ scope: "site", siteId: SITE_A, locationId: LOCATION_A });

    expect(result).toMatchObject({ ok: false, formError: expect.any(String) });
    expect(fake.calls).toEqual([]);
  });

  it("writes null for exactly this card's columns on Use inherited", async () => {
    expect(await save(atLocation(LOCATION_A), nulls)).toEqual({ ok: true });
    expectUpsert(
      { scope: "location", locationId: LOCATION_A },
      nulls,
      "user-1",
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
