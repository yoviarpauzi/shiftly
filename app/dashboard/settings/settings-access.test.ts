import { describe, expect, it } from "vitest";
import type { SettingsAccess, WorkRuleAccessTarget } from "@/types/settings";
import {
  canEditWorkRule,
  canViewWorkRule,
  settingsAccessFor,
  workRuleAccessTargetFor,
} from "./settings-access";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";

const user = (fields: {
  role?: string | null;
  siteId?: string | null;
  locationId?: string | null;
}) => ({ id: "user-1", ...fields });

const SUPERADMIN: SettingsAccess = {
  userId: "user-1",
  role: "superadmin",
  siteId: null,
  locationId: null,
};
const HO: SettingsAccess = { userId: "user-1", role: "ho", siteId: SITE_A, locationId: null };
const ADMIN_SITE: SettingsAccess = {
  userId: "user-1",
  role: "admin_site",
  siteId: SITE_A,
  locationId: LOCATION_A,
};

const globalTarget: WorkRuleAccessTarget = {
  scope: "global",
  siteId: null,
  locationId: null,
  locationSiteId: null,
};
const siteTarget = (siteId: string): WorkRuleAccessTarget => ({
  scope: "site",
  siteId,
  locationId: null,
  locationSiteId: null,
});
const locationTarget = (locationId: string, locationSiteId: string): WorkRuleAccessTarget => ({
  scope: "location",
  siteId: null,
  locationId,
  locationSiteId,
});

describe("settingsAccessFor", () => {
  it("gives superadmin every site and location", () => {
    expect(settingsAccessFor(user({ role: "superadmin" }), null)).toEqual({
      userId: "user-1",
      role: "superadmin",
      siteId: null,
      locationId: null,
    });
  });

  it("limits HO to its own site", () => {
    expect(settingsAccessFor(user({ role: "ho", siteId: SITE_A }), null)).toEqual({
      userId: "user-1",
      role: "ho",
      siteId: SITE_A,
      locationId: null,
    });
  });

  it("limits admin site to its own location, inside the site of that location", () => {
    expect(
      settingsAccessFor(user({ role: "admin_site", locationId: LOCATION_A }), SITE_A),
    ).toEqual({
      userId: "user-1",
      role: "admin_site",
      siteId: SITE_A,
      locationId: LOCATION_A,
    });
  });

  it("denies HO without a site, or with a location", () => {
    expect(settingsAccessFor(user({ role: "ho" }), null)).toBeNull();
    expect(
      settingsAccessFor(user({ role: "ho", siteId: SITE_A, locationId: LOCATION_A }), null),
    ).toBeNull();
  });

  it("denies admin site without a location, or when its location has no site", () => {
    expect(settingsAccessFor(user({ role: "admin_site" }), SITE_A)).toBeNull();
    expect(
      settingsAccessFor(user({ role: "admin_site", locationId: LOCATION_A }), null),
    ).toBeNull();
  });

  it("denies unknown and missing roles", () => {
    expect(settingsAccessFor(user({ role: "user" }), null)).toBeNull();
    expect(settingsAccessFor(user({ role: null }), null)).toBeNull();
    expect(settingsAccessFor(user({}), null)).toBeNull();
  });
});

describe("canEditWorkRule", () => {
  it("lets only superadmin edit the global row", () => {
    expect(canEditWorkRule(SUPERADMIN, globalTarget)).toBe(true);
    expect(canEditWorkRule(HO, globalTarget)).toBe(false);
    expect(canEditWorkRule(ADMIN_SITE, globalTarget)).toBe(false);
  });

  it("lets superadmin edit any site, and HO only its own", () => {
    expect(canEditWorkRule(SUPERADMIN, siteTarget(SITE_B))).toBe(true);
    expect(canEditWorkRule(HO, siteTarget(SITE_A))).toBe(true);
    expect(canEditWorkRule(HO, siteTarget(SITE_B))).toBe(false);
  });

  it("never lets admin site edit a site row, even its own", () => {
    expect(canEditWorkRule(ADMIN_SITE, siteTarget(SITE_A))).toBe(false);
    expect(canEditWorkRule(ADMIN_SITE, siteTarget(SITE_B))).toBe(false);
  });

  it("lets superadmin edit any location", () => {
    expect(canEditWorkRule(SUPERADMIN, locationTarget(LOCATION_B, SITE_B))).toBe(true);
  });

  it("lets HO edit locations of its own site only", () => {
    expect(canEditWorkRule(HO, locationTarget(LOCATION_B, SITE_A))).toBe(true);
    expect(canEditWorkRule(HO, locationTarget(LOCATION_B, SITE_B))).toBe(false);
  });

  it("lets admin site edit its own location only", () => {
    expect(canEditWorkRule(ADMIN_SITE, locationTarget(LOCATION_A, SITE_A))).toBe(true);
    expect(canEditWorkRule(ADMIN_SITE, locationTarget(LOCATION_B, SITE_A))).toBe(false);
  });

  it("denies a site or location target that has no id", () => {
    expect(canEditWorkRule(HO, { ...siteTarget(SITE_A), siteId: null })).toBe(false);
    expect(
      canEditWorkRule(HO, { ...locationTarget(LOCATION_A, SITE_A), locationSiteId: null }),
    ).toBe(false);
    expect(
      canEditWorkRule(ADMIN_SITE, { ...locationTarget(LOCATION_A, SITE_A), locationId: null }),
    ).toBe(false);
  });
});

describe("canViewWorkRule", () => {
  it("lets every role view the global row", () => {
    expect(canViewWorkRule(SUPERADMIN, globalTarget)).toBe(true);
    expect(canViewWorkRule(HO, globalTarget)).toBe(true);
    expect(canViewWorkRule(ADMIN_SITE, globalTarget)).toBe(true);
  });

  it("lets superadmin view any site, and HO and admin site only their own", () => {
    expect(canViewWorkRule(SUPERADMIN, siteTarget(SITE_B))).toBe(true);
    expect(canViewWorkRule(HO, siteTarget(SITE_A))).toBe(true);
    expect(canViewWorkRule(HO, siteTarget(SITE_B))).toBe(false);
    expect(canViewWorkRule(ADMIN_SITE, siteTarget(SITE_A))).toBe(true);
    expect(canViewWorkRule(ADMIN_SITE, siteTarget(SITE_B))).toBe(false);
  });

  it("lets superadmin view any location", () => {
    expect(canViewWorkRule(SUPERADMIN, locationTarget(LOCATION_B, SITE_B))).toBe(true);
  });

  it("lets HO view locations of its own site only", () => {
    expect(canViewWorkRule(HO, locationTarget(LOCATION_B, SITE_A))).toBe(true);
    expect(canViewWorkRule(HO, locationTarget(LOCATION_B, SITE_B))).toBe(false);
  });

  it("lets admin site view its own location only, not another of the same site", () => {
    expect(canViewWorkRule(ADMIN_SITE, locationTarget(LOCATION_A, SITE_A))).toBe(true);
    expect(canViewWorkRule(ADMIN_SITE, locationTarget(LOCATION_B, SITE_A))).toBe(false);
  });
});

describe("workRuleAccessTargetFor", () => {
  it("checks global with no ids", () => {
    expect(workRuleAccessTargetFor({ scope: "global", siteId: null, locationId: null })).toEqual({
      scope: "global",
      siteId: null,
      locationId: null,
      locationSiteId: null,
    });
  });

  it("checks a site by its id", () => {
    expect(workRuleAccessTargetFor({ scope: "site", siteId: SITE_A, locationId: null })).toEqual({
      scope: "site",
      siteId: SITE_A,
      locationId: null,
      locationSiteId: null,
    });
  });

  it("checks a location with the site that owns it", () => {
    expect(
      workRuleAccessTargetFor({ scope: "location", siteId: SITE_B, locationId: LOCATION_A }),
    ).toEqual({ scope: "location", siteId: null, locationId: LOCATION_A, locationSiteId: SITE_B });
  });

  it("lets an HO edit a location of its site but not one of another site", () => {
    const own = workRuleAccessTargetFor({
      scope: "location",
      siteId: SITE_A,
      locationId: LOCATION_A,
    });
    const other = workRuleAccessTargetFor({
      scope: "location",
      siteId: SITE_B,
      locationId: LOCATION_B,
    });

    expect(canEditWorkRule(HO, own)).toBe(true);
    expect(canEditWorkRule(HO, other)).toBe(false);
  });
});
