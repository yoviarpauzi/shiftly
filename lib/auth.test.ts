import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("./db", () => ({ db: {} }));
vi.mock("./scope-status", () => ({ userScopeIsActive: async () => true }));

const { auth } = await import("./auth");

describe("auth plugins", () => {
  // changePassword revokes the other sessions and sets a new session cookie. A server action only
  // applies that cookie through nextCookies, and the plugin must run after every other plugin.
  it("registers nextCookies as the last plugin", () => {
    expect(auth.options.plugins?.at(-1)?.id).toBe("next-cookies");
  });
});

describe("auth disabled paths", () => {
  // The admin plugin allows adminRoles to call its read endpoints. The app uses none of them, and
  // list-user-sessions would return session tokens, so they are closed like the write endpoints.
  it.each([
    "/admin/list-users",
    "/admin/get-user",
    "/admin/list-user-sessions",
    "/admin/has-permission",
  ])("disables %s", (path) => {
    expect(auth.options.disabledPaths).toContain(path);
  });
});
