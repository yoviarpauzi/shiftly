import { readFileSync } from "node:fs";
import { verifyPassword } from "better-auth/crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { account, session, user } from "@/database/schema/auth-schema";
import { location } from "@/database/schema/location-schema";
import {
  LAST_HO_MESSAGE,
  SELF_DEACTIVATE_MESSAGE,
  USER_NOT_FOUND_MESSAGE,
} from "./user-rules";
import type { UserAccess } from "@/types/users";

// The database is replaced by a recorder. Every query is logged as a Call, and the
// result of a read comes from `rows`, keyed by what the query reads.
type Call = {
  op: "select" | "insert" | "update" | "delete";
  table?: unknown;
  fields?: Record<string, unknown>;
  values?: Record<string, unknown>;
  set?: Record<string, unknown>;
  lock?: string;
};

const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  rows: {
    target: [] as unknown[],
    hos: [] as unknown[],
    location: [] as unknown[],
  },
  insertError: null as unknown,
  access: null as unknown,
}));

function result(call: Call): unknown {
  if (call.op === "select") {
    if (call.table === user && call.fields && "banned" in call.fields) {
      return fake.rows.target;
    }
    if (call.table === user) return fake.rows.hos;
    if (call.table === location) return fake.rows.location;
    return [];
  }

  if (call.op === "insert" && call.table === user && fake.insertError) {
    throw fake.insertError;
  }

  if (call.op === "update" && call.table === user && fake.insertError) {
    throw fake.insertError;
  }

  if (call.op === "update" && call.table === account) {
    return [{ id: "account-1" }];
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
    where: () => chain,
    orderBy: () => chain,
    returning: () => chain,
    for(strength: string) {
      call.lock = strength;
      return chain;
    },
    values(values: Record<string, unknown>) {
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

const tx = {
  select: (fields?: Record<string, unknown>) => builder({ op: "select", fields }),
  insert: (table: unknown) => builder({ op: "insert", table }),
  update: (table: unknown) => builder({ op: "update", table }),
  delete: (table: unknown) => builder({ op: "delete", table }),
};

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./user-guard", () => ({
  requireUserManager: async () => fake.access,
}));
vi.mock("@/lib/db", () => ({
  db: { ...tx, transaction: async (run: (t: typeof tx) => unknown) => run(tx) },
}));

const { createUser, updateUser, deactivateUser, reactivateUser } = await import("./actions");

const LOCATION_A = "33333333-3333-4333-8333-333333333333";

const ho: UserAccess = { id: "ho-1", role: "ho" };

const adminSiteInput = {
  name: "Ana",
  email: "ana@example.com",
  password: "secret-pass",
  role: "admin_site" as const,
  locationId: LOCATION_A,
};

const hoInput = {
  name: "Hana",
  email: "hana@example.com",
  password: "secret-pass",
  role: "ho" as const,
  locationId: null,
};

const targetRow = (fields: Record<string, unknown>) => ({
  id: "user-7",
  role: "admin_site",
  banned: false,
  ...fields,
});

const writes = () => fake.calls.filter((call) => call.op !== "select");

beforeEach(() => {
  fake.calls = [];
  fake.rows = { target: [], hos: [], location: [] };
  fake.insertError = null;
  fake.access = ho;
});

describe("user actions module", () => {
  it("opens with the use server directive so client components can call it", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

    expect(source.split("\n")[0].trim()).toBe('"use server";');
  });
});

describe("createUser", () => {
  it("refuses an admin site whose location is missing or deleted and writes nothing", async () => {
    fake.rows.location = [];

    const res = await createUser(adminSiteInput);

    expect(res).toEqual({ ok: false, fieldErrors: { locationId: "Choose a location" } });
    expect(writes()).toEqual([]);
  });

  it("refuses an admin site without a location before touching the database", async () => {
    const res = await createUser({ ...adminSiteInput, locationId: null });

    expect(res).toEqual({ ok: false, fieldErrors: { locationId: "Choose a location" } });
    expect(fake.calls).toEqual([]);
  });

  it("refuses an HO that has a location", async () => {
    const res = await createUser({ ...hoInput, locationId: LOCATION_A });

    expect(res).toEqual({ ok: false, fieldErrors: { locationId: "This role has no location" } });
    expect(fake.calls).toEqual([]);
  });

  it("creates an HO with no location and no location lookup", async () => {
    const res = await createUser(hoInput);

    expect(res).toEqual({ ok: true });
    const userInsert = fake.calls.find((c) => c.op === "insert" && c.table === user);
    expect(userInsert?.values).toMatchObject({ role: "ho", locationId: null });
    expect(fake.calls.some((c) => c.op === "select" && c.table === location)).toBe(false);
  });

  it("maps a duplicate email to the email field", async () => {
    fake.rows.location = [{ id: LOCATION_A }];
    fake.insertError = { code: "23505" };

    const res = await createUser(adminSiteInput);

    expect(res).toEqual({
      ok: false,
      fieldErrors: { email: "This email is already used by another account" },
    });
  });

  it("writes the user, then a credential account whose hash verifies", async () => {
    fake.rows.location = [{ id: LOCATION_A }];

    const res = await createUser(adminSiteInput);
    expect(res).toEqual({ ok: true });

    const userInsert = fake.calls.find((c) => c.op === "insert" && c.table === user);
    const accountInsert = fake.calls.find((c) => c.op === "insert" && c.table === account);

    expect(userInsert?.values).toMatchObject({
      email: "ana@example.com",
      role: "admin_site",
      locationId: LOCATION_A,
      emailVerified: false,
      banned: false,
    });
    expect(accountInsert?.values).toMatchObject({
      providerId: "credential",
      userId: userInsert?.values?.id,
      accountId: userInsert?.values?.id,
    });
    const hash = accountInsert?.values?.password as string;
    expect(await verifyPassword({ hash, password: "secret-pass" })).toBe(true);
    expect(await verifyPassword({ hash, password: "wrong-pass" })).toBe(false);
  });
});

describe("updateUser", () => {
  const target = targetRow({ id: "user-9" });

  it("keeps the password and the sessions when the password is empty", async () => {
    fake.rows.target = [target];
    fake.rows.location = [{ id: LOCATION_A }];

    const res = await updateUser("user-9", { ...adminSiteInput, password: "" });

    expect(res).toEqual({ ok: true });
    expect(fake.calls.some((c) => c.table === account && c.op !== "select")).toBe(false);
    expect(fake.calls.some((c) => c.op === "delete" && c.table === session)).toBe(false);
  });

  it("replaces the password and deletes the user's sessions", async () => {
    fake.rows.target = [target];
    fake.rows.location = [{ id: LOCATION_A }];

    const res = await updateUser("user-9", { ...adminSiteInput, password: "new-secret-pass" });

    expect(res).toEqual({ ok: true });
    const accountUpdate = fake.calls.find((c) => c.op === "update" && c.table === account);
    const hash = accountUpdate?.set?.password as string;
    expect(await verifyPassword({ hash, password: "new-secret-pass" })).toBe(true);
    expect(fake.calls.some((c) => c.op === "delete" && c.table === session)).toBe(true);
  });

  it("maps a duplicate email to the email field", async () => {
    fake.rows.target = [target];
    fake.rows.location = [{ id: LOCATION_A }];
    fake.insertError = { cause: { code: "23505" } };

    const res = await updateUser("user-9", { ...adminSiteInput, password: "" });

    expect(res).toEqual({
      ok: false,
      fieldErrors: { email: "This email is already used by another account" },
    });
  });

  it("returns not found for an unknown user", async () => {
    fake.rows.target = [];

    const res = await updateUser("user-9", { ...adminSiteInput, password: "" });

    expect(res).toEqual({ ok: false, formError: USER_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("refuses to demote the only active HO, counting under a lock", async () => {
    fake.rows.target = [targetRow({ id: "ho-2", role: "ho" })];
    fake.rows.hos = [{ id: "ho-2" }];

    const res = await updateUser("ho-2", { ...adminSiteInput, password: "" });

    expect(res).toEqual({ ok: false, formError: LAST_HO_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("demotes an HO when another remains", async () => {
    fake.rows.target = [targetRow({ id: "ho-2", role: "ho" })];
    fake.rows.hos = [{ id: "ho-1" }, { id: "ho-2" }];
    fake.rows.location = [{ id: LOCATION_A }];

    const res = await updateUser("ho-2", { ...adminSiteInput, password: "" });

    expect(res).toEqual({ ok: true });
  });

  it("refuses to change the caller's own role", async () => {
    fake.rows.target = [targetRow({ id: "ho-1", role: "ho" })];
    fake.rows.hos = [{ id: "ho-1" }, { id: "ho-2" }];

    const res = await updateUser("ho-1", { ...adminSiteInput, password: "" });

    expect(res).toEqual({ ok: false, formError: "You cannot change your own role" });
    expect(writes()).toEqual([]);
  });
});

describe("reactivateUser", () => {
  it("lifts the ban and its details without restoring sessions", async () => {
    fake.rows.target = [targetRow({ banned: true })];

    const res = await reactivateUser("user-7");

    expect(res).toEqual({ ok: true });
    expect(writes()).toEqual([
      {
        op: "update",
        table: user,
        set: { banned: false, banReason: null, banExpires: null },
      },
    ]);
  });
});

describe("deactivateUser", () => {
  const lockedCount = () =>
    fake.calls.find(
      (c) => c.op === "select" && c.table === user && !(c.fields && "banned" in c.fields),
    );

  it("refuses to deactivate the caller", async () => {
    fake.rows.target = [targetRow({ id: "ho-1", role: "ho" })];
    fake.rows.hos = [{ id: "ho-1" }, { id: "ho-2" }];

    const res = await deactivateUser("ho-1");

    expect(res).toEqual({ ok: false, formError: SELF_DEACTIVATE_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("refuses to deactivate the only active HO, counting under a lock that spares sign-ins", async () => {
    fake.rows.target = [targetRow({ id: "ho-2", role: "ho" })];
    fake.rows.hos = [{ id: "ho-2" }];

    const res = await deactivateUser("ho-2");

    expect(res).toEqual({ ok: false, formError: LAST_HO_MESSAGE });
    expect(writes()).toEqual([]);
    expect(lockedCount()?.lock).toBe("no key update");
  });

  it("deactivates an HO when another active HO remains", async () => {
    fake.rows.target = [targetRow({ id: "ho-2", role: "ho" })];
    fake.rows.hos = [{ id: "ho-1" }, { id: "ho-2" }];

    const res = await deactivateUser("ho-2");

    expect(res).toEqual({ ok: true });
  });

  it("returns not found for an unknown user", async () => {
    fake.rows.target = [];

    const res = await deactivateUser("user-7");

    expect(res).toEqual({ ok: false, formError: USER_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("bans the user and deletes its sessions", async () => {
    fake.rows.target = [targetRow({})];
    fake.rows.hos = [{ id: "ho-1" }];

    const res = await deactivateUser("user-7");

    expect(res).toEqual({ ok: true });
    const ban = fake.calls.find((c) => c.op === "update" && c.table === user);
    expect(ban?.set).toEqual({ banned: true, banExpires: null });
    expect(fake.calls.some((c) => c.op === "delete" && c.table === session)).toBe(true);
  });
});
