import { describe, expect, it } from "vitest";
import type { ManagedTarget, UserAccess } from "@/types/users";
import {
  assignableRoles,
  canAssign,
  canManageUser,
  userAccessFor,
} from "./user-access";

const SITE = "11111111-1111-4111-8111-111111111111";
const LOCATION = "33333333-3333-4333-8333-333333333333";

const user = (fields: {
  role?: string | null;
  siteId?: string | null;
  locationId?: string | null;
}) => ({ id: "user-1", ...fields });

describe("userAccessFor", () => {
  it("gives superadmin every site, even when a site is set", () => {
    expect(userAccessFor(user({ role: "superadmin", siteId: SITE }))).toEqual({
      id: "user-1",
      role: "superadmin",
      siteId: null,
    });
  });

  it("limits HO to its own site", () => {
    expect(userAccessFor(user({ role: "ho", siteId: SITE }))).toEqual({
      id: "user-1",
      role: "ho",
      siteId: SITE,
    });
  });

  it("refuses HO without a site", () => {
    expect(userAccessFor(user({ role: "ho" }))).toBeNull();
  });

  it("refuses HO that also has a location", () => {
    expect(
      userAccessFor(user({ role: "ho", siteId: SITE, locationId: LOCATION })),
    ).toBeNull();
  });

  it("refuses admin site, even with a location", () => {
    expect(
      userAccessFor(user({ role: "admin_site", siteId: SITE, locationId: LOCATION })),
    ).toBeNull();
  });

  it("refuses a null or missing role", () => {
    expect(userAccessFor(user({ role: null }))).toBeNull();
    expect(userAccessFor(user({}))).toBeNull();
  });
});

const OTHER_SITE = "22222222-2222-4222-8222-222222222222";

const superadmin: UserAccess = { id: "boss", role: "superadmin", siteId: null };
const ho: UserAccess = { id: "ho-1", role: "ho", siteId: SITE };

const target = (fields: Partial<ManagedTarget>): ManagedTarget => ({
  id: "target-1",
  role: "admin_site",
  siteId: SITE,
  locationSiteId: SITE,
  ...fields,
});

describe("assignableRoles", () => {
  it("gives superadmin all three roles", () => {
    expect(assignableRoles(superadmin)).toEqual(["superadmin", "ho", "admin_site"]);
  });

  it("gives HO only admin site", () => {
    expect(assignableRoles(ho)).toEqual(["admin_site"]);
  });
});

describe("canManageUser", () => {
  it.each([
    ["superadmin manages an HO", superadmin, target({ role: "ho", locationSiteId: null }), true],
    [
      "superadmin manages a superadmin in another site",
      superadmin,
      target({ role: "superadmin", siteId: OTHER_SITE, locationSiteId: null }),
      true,
    ],
    ["HO manages an admin site in its own site", ho, target({}), true],
    [
      "HO cannot manage an admin site in another site",
      ho,
      target({ siteId: OTHER_SITE, locationSiteId: OTHER_SITE }),
      false,
    ],
    ["HO cannot manage an admin site without a location", ho, target({ locationSiteId: null }), false],
    ["HO cannot manage an HO", ho, target({ role: "ho" }), false],
    ["HO cannot manage a superadmin", ho, target({ role: "superadmin" }), false],
    ["HO cannot manage a user without a role", ho, target({ role: null }), false],
  ])("%s", (_name, access, subject, expected) => {
    expect(canManageUser(access, subject)).toBe(expected);
  });
});

describe("canAssign", () => {
  it.each([
    ["superadmin assigns superadmin anywhere", superadmin, "superadmin", OTHER_SITE, true],
    ["superadmin assigns HO anywhere", superadmin, "ho", OTHER_SITE, true],
    ["superadmin assigns admin site anywhere", superadmin, "admin_site", OTHER_SITE, true],
    ["HO assigns admin site at its own site", ho, "admin_site", SITE, true],
    ["HO cannot assign admin site at another site", ho, "admin_site", OTHER_SITE, false],
    ["HO cannot assign admin site without a location", ho, "admin_site", null, false],
    ["HO cannot assign ho at its own site", ho, "ho", SITE, false],
    ["HO cannot assign superadmin at its own site", ho, "superadmin", SITE, false],
  ] as const)("%s", (_name, access, role, locationSiteId, expected) => {
    expect(canAssign(access, { role }, locationSiteId)).toBe(expected);
  });
});
