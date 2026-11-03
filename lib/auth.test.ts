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
