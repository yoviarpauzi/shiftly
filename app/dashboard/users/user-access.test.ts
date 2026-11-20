import { describe, expect, it } from "vitest";
import type { ManagedTarget, UserAccess } from "@/types/users";
import { assignableRoles, canManageUser, userAccessFor } from "./user-access";

const LOCATION = "33333333-3333-4333-8333-333333333333";

const user = (fields: { role?: string | null; locationId?: string | null }) => ({
  id: "user-1",
  ...fields,
});

describe("userAccessFor", () => {
  it("gives HO without a location the access", () => {
    expect(userAccessFor(user({ role: "ho" }))).toEqual({ id: "user-1", role: "ho" });
    expect(userAccessFor(user({ role: "ho", locationId: null }))).toEqual({
      id: "user-1",
      role: "ho",
    });
  });

  it("refuses HO that also has a location", () => {
    expect(userAccessFor(user({ role: "ho", locationId: LOCATION }))).toBeNull();
  });

  it("refuses admin site, even with a location", () => {
    expect(userAccessFor(user({ role: "admin_site", locationId: LOCATION }))).toBeNull();
  });

  it("refuses a rejected role, a null role and a missing role", () => {
    expect(userAccessFor(user({ role: "superadmin" }))).toBeNull();
    expect(userAccessFor(user({ role: null }))).toBeNull();
    expect(userAccessFor(user({}))).toBeNull();
  });
});

const ho: UserAccess = { id: "ho-1", role: "ho" };

const target = (fields: Partial<ManagedTarget>): ManagedTarget => ({
  id: "target-1",
  role: "admin_site",
  banned: false,
  ...fields,
});

describe("assignableRoles", () => {
  it("gives HO both roles", () => {
    expect(assignableRoles(ho)).toEqual(["ho", "admin_site"]);
  });
});

describe("canManageUser", () => {
  it.each([
    ["an admin site", target({})],
    ["an HO", target({ role: "ho" })],
    ["a banned user", target({ banned: true })],
    ["a user without a role", target({ role: null })],
  ])("HO manages %s", (_name, subject) => {
    expect(canManageUser(ho, subject)).toBe(true);
  });
});
