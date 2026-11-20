import { describe, expect, it } from "vitest";
import type { ManagedTarget, UserAccess } from "@/types/users";
import {
  guardDeactivation,
  guardRoleChange,
  LAST_HO_MESSAGE,
  SELF_DEACTIVATE_MESSAGE,
  SELF_ROLE_MESSAGE,
  USER_NOT_FOUND_MESSAGE,
} from "./user-rules";

const ho: UserAccess = { id: "ho-1", role: "ho" };

const target = (fields: Partial<ManagedTarget>): ManagedTarget => ({
  id: "target-1",
  role: "admin_site",
  banned: false,
  ...fields,
});

describe("messages", () => {
  it("uses the exact text", () => {
    expect(USER_NOT_FOUND_MESSAGE).toBe("User not found");
    expect(SELF_ROLE_MESSAGE).toBe("You cannot change your own role");
    expect(SELF_DEACTIVATE_MESSAGE).toBe("You cannot deactivate your own account");
    expect(LAST_HO_MESSAGE).toBe("The last active HO cannot be deactivated or demoted");
  });
});

describe("guardRoleChange", () => {
  it.each([
    ["role unchanged", target({ role: "ho" }), "ho", 1, null],
    ["role unchanged for an admin site", target({}), "admin_site", 1, null],
    ["HO changes own role", target({ id: "ho-1", role: "ho" }), "admin_site", 3, SELF_ROLE_MESSAGE],
    [
      "self wins over last HO",
      target({ id: "ho-1", role: "ho" }),
      "admin_site",
      1,
      SELF_ROLE_MESSAGE,
    ],
    ["demotes the only active HO", target({ role: "ho" }), "admin_site", 1, LAST_HO_MESSAGE],
    ["demotes an HO when another remains", target({ role: "ho" }), "admin_site", 2, null],
    [
      "demotes a banned HO even when it is the only one counted",
      target({ role: "ho", banned: true }),
      "admin_site",
      1,
      null,
    ],
    ["promotes an admin site to HO", target({}), "ho", 1, null],
  ] as const)("%s", (_name, subject, nextRole, count, expected) => {
    expect(guardRoleChange(ho, subject, nextRole, count)).toBe(expected);
  });
});

describe("guardDeactivation", () => {
  it.each([
    ["self", target({ id: "ho-1", role: "ho" }), 3, SELF_DEACTIVATE_MESSAGE],
    ["self wins over last HO", target({ id: "ho-1", role: "ho" }), 1, SELF_DEACTIVATE_MESSAGE],
    ["the only active HO", target({ role: "ho" }), 1, LAST_HO_MESSAGE],
    ["an HO when another remains", target({ role: "ho" }), 2, null],
    ["a banned HO", target({ role: "ho", banned: true }), 1, null],
    ["an admin site", target({}), 1, null],
  ] as const)("%s", (_name, subject, count, expected) => {
    expect(guardDeactivation(ho, subject, count)).toBe(expected);
  });
});
