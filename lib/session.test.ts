import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  session: null as unknown,
  scopeActive: true,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => fake.session } },
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
});
