import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  session: null as unknown,
  scopeActive: true,
  requestHeaders: new Headers(),
  storeCookies: "",
  seenHeaders: null as Headers | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => fake.requestHeaders,
  cookies: async () => ({ toString: () => fake.storeCookies }),
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        fake.seenHeaders = headers;
        return fake.session;
      },
    },
  },
}));
vi.mock("@/lib/scope-status", () => ({
  userScopeIsActive: async () => fake.scopeActive,
}));

const { getCurrentUser } = await import("./session");

const activeUser = {
  id: "user-1",
  role: "superadmin",
  banned: false,
  siteId: null,
  locationId: null,
};

beforeEach(() => {
  fake.session = null;
  fake.scopeActive = true;
  fake.requestHeaders = new Headers();
  fake.storeCookies = "";
  fake.seenHeaders = null;
});

describe("getCurrentUser", () => {
  it("returns the user of an active session", async () => {
    fake.session = { user: activeUser };

    expect(await getCurrentUser()).toEqual(activeUser);
  });

  it("returns null for a banned user even when the session still exists", async () => {
    fake.session = { user: { ...activeUser, banned: true } };

    expect(await getCurrentUser()).toBeNull();
  });

  // After a server action replaces the session cookie (changePassword), Next re-renders with
  // the cookies() store updated while headers() still holds the old, revoked token.
  it("reads the session from the cookie store, not the stale request Cookie header", async () => {
    fake.requestHeaders = new Headers({
      cookie: "better-auth.session_token=old.sig",
      "user-agent": "vitest",
    });
    fake.storeCookies = "better-auth.session_token=new.sig";
    fake.session = { user: activeUser };

    await getCurrentUser();

    expect(fake.seenHeaders?.get("cookie")).toBe("better-auth.session_token=new.sig");
    expect(fake.seenHeaders?.get("user-agent")).toBe("vitest");
    expect(fake.requestHeaders.get("cookie")).toBe("better-auth.session_token=old.sig");
  });

  it("sends no Cookie header when the store has no cookies", async () => {
    fake.requestHeaders = new Headers({ cookie: "better-auth.session_token=old.sig" });
    fake.storeCookies = "";

    expect(await getCurrentUser()).toBeNull();
    expect(fake.seenHeaders?.has("cookie")).toBe(false);
  });

  it("still refuses a user whose site or location was deleted", async () => {
    fake.storeCookies = "better-auth.session_token=new.sig";
    fake.session = { user: activeUser };
    fake.scopeActive = false;

    expect(await getCurrentUser()).toBeNull();
  });
});
