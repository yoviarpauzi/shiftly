import { readFileSync } from "node:fs";
import { verifyPassword } from "better-auth/crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { account, session, user } from "@/database/schema/auth-schema";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import {
  LAST_SUPERADMIN_MESSAGE,
  LOCATION_OUT_OF_SCOPE_MESSAGE,
  SELF_DEACTIVATE_MESSAGE,
  USER_NOT_FOUND_MESSAGE,
} from "@/lib/user-rules";
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
    superadmins: [] as unknown[],
    location: [] as unknown[],
    site: [] as unknown[],
  },
  insertError: null as unknown,
  access: null as unknown,
}));

function result(call: Call): unknown {
  if (call.op === "select") {
    if (call.table === user && call.fields && "locationSiteId" in call.fields) {
      return fake.rows.target;
    }
    if (call.table === user) return fake.rows.superadmins;
    if (call.table === location) return fake.rows.location;
    if (call.table === site) return fake.rows.site;
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
vi.mock("@/lib/session", () => ({
  requireUserManager: async () => fake.access,
}));
vi.mock("@/lib/db", () => ({
  db: { ...tx, transaction: async (run: (t: typeof tx) => unknown) => run(tx) },
}));

const { createUser, updateUser, deactivateUser, reactivateUser } = await import("./actions");

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";

const superadmin: UserAccess = { id: "super-1", role: "superadmin", siteId: null };
const ho: UserAccess = { id: "ho-1", role: "ho", siteId: SITE_A };

const adminSiteInput = {
  name: "Ana",
  email: "ana@example.com",
  password: "secret-pass",
  role: "admin_site" as const,
  siteId: null,
  locationId: LOCATION_A,
};

const writes = () => fake.calls.filter((call) => call.op !== "select");

beforeEach(() => {
  fake.calls = [];
  fake.rows = { target: [], superadmins: [], location: [], site: [] };
  fake.insertError = null;
  fake.access = superadmin;
});

describe("user actions module", () => {
  it("opens with the use server directive so client components can call it", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

    expect(source.split("\n")[0].trim()).toBe('"use server";');
  });
});

describe("createUser", () => {
  it("refuses an HO location outside HO's site and writes nothing", async () => {
    fake.access = ho;
    fake.rows.location = [{ siteId: SITE_B }];

    const res = await createUser({ ...adminSiteInput, locationId: LOCATION_B });

    expect(res).toEqual({ ok: false, fieldErrors: { locationId: LOCATION_OUT_OF_SCOPE_MESSAGE } });
    expect(writes()).toEqual([]);
  });

  it("refuses a role HO cannot assign", async () => {
    fake.access = ho;

    const res = await createUser({
      ...adminSiteInput,
      role: "ho",
      siteId: SITE_A,
      locationId: null,
    });

    expect(res).toEqual({ ok: false, fieldErrors: { role: "Choose a role" } });
    expect(writes()).toEqual([]);
  });

  it("maps a duplicate email to the email field", async () => {
    fake.rows.location = [{ siteId: SITE_A }];
    fake.insertError = { code: "23505" };

    const res = await createUser(adminSiteInput);

    expect(res).toEqual({
      ok: false,
      fieldErrors: { email: "This email is already used by another account" },
    });
  });

  it("writes the user, then a credential account whose hash verifies", async () => {
    fake.access = ho;
    fake.rows.location = [{ siteId: SITE_A }];

    const res = await createUser(adminSiteInput);
    expect(res).toEqual({ ok: true });

    const userInsert = fake.calls.find((c) => c.op === "insert" && c.table === user);
    const accountInsert = fake.calls.find((c) => c.op === "insert" && c.table === account);

    expect(userInsert?.values).toMatchObject({
      email: "ana@example.com",
      role: "admin_site",
      siteId: null,
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
  const target = {
    id: "user-9",
    role: "admin_site",
    siteId: null,
    locationSiteId: SITE_A,
    banned: false,
  };

  it("keeps the password and the sessions when the password is empty", async () => {
    fake.rows.target = [target];
    fake.rows.location = [{ siteId: SITE_A }];

    const res = await updateUser("user-9", { ...adminSiteInput, password: "" });

    expect(res).toEqual({ ok: true });
    expect(fake.calls.some((c) => c.table === account && c.op !== "select")).toBe(false);
    expect(fake.calls.some((c) => c.op === "delete" && c.table === session)).toBe(false);
  });

  it("replaces the password and deletes the user's sessions", async () => {
    fake.rows.target = [target];
    fake.rows.location = [{ siteId: SITE_A }];

    const res = await updateUser("user-9", { ...adminSiteInput, password: "new-secret-pass" });

    expect(res).toEqual({ ok: true });
    const accountUpdate = fake.calls.find((c) => c.op === "update" && c.table === account);
    const hash = accountUpdate?.set?.password as string;
    expect(await verifyPassword({ hash, password: "new-secret-pass" })).toBe(true);
    expect(fake.calls.some((c) => c.op === "delete" && c.table === session)).toBe(true);
  });

  it("maps a duplicate email to the email field", async () => {
    fake.rows.target = [target];
    fake.rows.location = [{ siteId: SITE_A }];
    fake.insertError = { cause: { code: "23505" } };

    const res = await updateUser("user-9", { ...adminSiteInput, password: "" });

    expect(res).toEqual({
      ok: false,
      fieldErrors: { email: "This email is already used by another account" },
    });
  });

  it("hides an admin site user in another site from HO", async () => {
    fake.access = ho;
    fake.rows.target = [{ ...target, locationSiteId: SITE_B }];
    fake.rows.location = [{ siteId: SITE_A }];

    const res = await updateUser("user-9", { ...adminSiteInput, password: "" });

    expect(res).toEqual({ ok: false, formError: USER_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });
});

describe("reactivateUser", () => {
  it("lifts the ban and its details without restoring sessions", async () => {
    fake.rows.target = [
      { id: "user-7", role: "admin_site", siteId: null, locationSiteId: SITE_A, banned: true },
    ];

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
  it("refuses to deactivate the caller", async () => {
    fake.rows.target = [
      { id: "super-1", role: "superadmin", siteId: null, locationSiteId: null, banned: false },
    ];
    fake.rows.superadmins = [{ id: "super-1" }, { id: "super-2" }];

    const res = await deactivateUser("super-1");

    expect(res).toEqual({ ok: false, formError: SELF_DEACTIVATE_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("refuses to deactivate the last active superadmin, counting under a lock", async () => {
    fake.rows.target = [
      { id: "super-2", role: "superadmin", siteId: null, locationSiteId: null, banned: false },
    ];
    fake.rows.superadmins = [{ id: "super-2" }];

    const res = await deactivateUser("super-2");

    expect(res).toEqual({ ok: false, formError: LAST_SUPERADMIN_MESSAGE });
    expect(writes()).toEqual([]);
    const lockedCount = fake.calls.find(
      (c) => c.op === "select" && c.table === user && !(c.fields && "locationSiteId" in c.fields),
    );
    expect(lockedCount?.lock).toBe("no key update");
  });

  it("hides a superadmin from HO before any guard runs", async () => {
    fake.access = ho;
    fake.rows.target = [
      { id: "super-2", role: "superadmin", siteId: null, locationSiteId: null, banned: false },
    ];
    fake.rows.superadmins = [{ id: "super-2" }];

    const res = await deactivateUser("super-2");

    expect(res).toEqual({ ok: false, formError: USER_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("hides an admin site user in another site from HO", async () => {
    fake.access = ho;
    fake.rows.target = [
      { id: "user-7", role: "admin_site", siteId: null, locationSiteId: SITE_B, banned: false },
    ];

    const res = await deactivateUser("user-7");

    expect(res).toEqual({ ok: false, formError: USER_NOT_FOUND_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("bans the user and deletes its sessions", async () => {
    fake.rows.target = [
      { id: "user-7", role: "admin_site", siteId: null, locationSiteId: SITE_A, banned: false },
    ];
    fake.rows.superadmins = [{ id: "super-1" }];

    const res = await deactivateUser("user-7");

    expect(res).toEqual({ ok: true });
    const ban = fake.calls.find((c) => c.op === "update" && c.table === user);
    expect(ban?.set).toEqual({ banned: true, banExpires: null });
    expect(fake.calls.some((c) => c.op === "delete" && c.table === session)).toBe(true);
  });
});
