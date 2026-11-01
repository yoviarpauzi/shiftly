import { describe, expect, it } from "vitest";
import type { ManagedTarget, UserAccess } from "@/types/users";
import {
  guardDeactivation,
  guardRoleChange,
  LAST_SUPERADMIN_MESSAGE,
  LOCATION_OUT_OF_SCOPE_MESSAGE,
  ROLE_LOCKED_MESSAGE,
  SELF_DEACTIVATE_MESSAGE,
  SELF_ROLE_MESSAGE,
  USER_NOT_FOUND_MESSAGE,
} from "./user-rules";

const SITE = "11111111-1111-4111-8111-111111111111";

const superadmin: UserAccess = { id: "boss", role: "superadmin", siteId: null };
const ho: UserAccess = { id: "ho-1", role: "ho", siteId: SITE };

const target = (fields: Partial<ManagedTarget>): ManagedTarget => ({
  id: "target-1",
  role: "admin_site",
  siteId: SITE,
  locationSiteId: SITE,
  ...fields,
});

describe("messages", () => {
  it("uses the exact text", () => {
    expect(USER_NOT_FOUND_MESSAGE).toBe("User not found");
    expect(LOCATION_OUT_OF_SCOPE_MESSAGE).toBe("Choose a location in your site");
    expect(ROLE_LOCKED_MESSAGE).toBe("You cannot change this user's role");
    expect(SELF_ROLE_MESSAGE).toBe("You cannot change your own role");
    expect(SELF_DEACTIVATE_MESSAGE).toBe("You cannot deactivate your own account");
    expect(LAST_SUPERADMIN_MESSAGE).toBe(
      "The last active superadmin cannot be deactivated or demoted",
    );
  });
});

describe("guardRoleChange", () => {
  it.each([
    ["role unchanged", superadmin, target({ role: "ho" }), "ho", 1, null],
    ["role unchanged, even for HO", ho, target({}), "admin_site", 1, null],
    ["HO changes an admin site role", ho, target({}), "ho", 3, ROLE_LOCKED_MESSAGE],
    [
      "locked wins over self",
      ho,
      target({ id: "ho-1", role: "ho" }),
      "admin_site",
      3,
      ROLE_LOCKED_MESSAGE,
    ],
    [
      "superadmin changes own role",
      superadmin,
      target({ id: "boss", role: "superadmin" }),
      "ho",
      3,
      SELF_ROLE_MESSAGE,
    ],
    [
      "self wins over last superadmin",
      superadmin,
      target({ id: "boss", role: "superadmin" }),
      "ho",
      1,
      SELF_ROLE_MESSAGE,
    ],
    [
      "demotes the last superadmin",
      superadmin,
      target({ role: "superadmin" }),
      "ho",
      1,
      LAST_SUPERADMIN_MESSAGE,
    ],
    ["demotes a superadmin when others remain", superadmin, target({ role: "superadmin" }), "ho", 2, null],
    ["promotes an admin site to HO", superadmin, target({}), "ho", 1, null],
  ] as const)("%s", (_name, access, subject, nextRole, count, expected) => {
    expect(guardRoleChange(access, subject, nextRole, count)).toBe(expected);
  });
});

describe("guardDeactivation", () => {
  it.each([
    ["self", superadmin, target({ id: "boss", role: "superadmin" }), 3, SELF_DEACTIVATE_MESSAGE],
    [
      "self wins over last superadmin",
      superadmin,
      target({ id: "boss", role: "superadmin" }),
      1,
      SELF_DEACTIVATE_MESSAGE,
    ],
    ["the last superadmin", superadmin, target({ role: "superadmin" }), 1, LAST_SUPERADMIN_MESSAGE],
    ["a superadmin when another remains", superadmin, target({ role: "superadmin" }), 2, null],
    ["a non-superadmin", ho, target({}), 1, null],
  ] as const)("%s", (_name, access, subject, count, expected) => {
    expect(guardDeactivation(access, subject, count)).toBe(expected);
  });
});
