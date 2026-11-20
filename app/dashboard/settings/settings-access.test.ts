import { describe, expect, it } from "vitest";
import type { SettingsAccess, WorkRuleAccessTarget } from "@/types/settings";
import {
  canEditWorkRule,
  canViewWorkRule,
  settingsAccessFor,
  workRuleAccessTargetFor,
} from "./settings-access";

const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";

const user = (fields: { role?: string | null; locationId?: string | null }) => ({
  id: "user-1",
  ...fields,
});

const HO: SettingsAccess = { userId: "user-1", role: "ho", locationId: null };
const ADMIN_SITE: SettingsAccess = {
  userId: "user-1",
  role: "admin_site",
  locationId: LOCATION_A,
};

const globalTarget: WorkRuleAccessTarget = { scope: "global", locationId: null };
const locationTarget = (locationId: string | null): WorkRuleAccessTarget => ({
  scope: "location",
  locationId,
});

describe("settingsAccessFor", () => {
  it("gives HO every location, with no location of its own", () => {
    expect(settingsAccessFor(user({ role: "ho" }))).toEqual({
      userId: "user-1",
      role: "ho",
      locationId: null,
    });
  });

  it("limits admin site to its own location", () => {
    expect(settingsAccessFor(user({ role: "admin_site", locationId: LOCATION_A }))).toEqual({
      userId: "user-1",
      role: "admin_site",
      locationId: LOCATION_A,
    });
  });

  it("denies HO that carries a location", () => {
    expect(settingsAccessFor(user({ role: "ho", locationId: LOCATION_A }))).toBeNull();
  });

  it("denies admin site without a location", () => {
    expect(settingsAccessFor(user({ role: "admin_site" }))).toBeNull();
    expect(settingsAccessFor(user({ role: "admin_site", locationId: null }))).toBeNull();
  });

  it("denies unknown, removed, and missing roles", () => {
    expect(settingsAccessFor(user({ role: "user" }))).toBeNull();
    expect(settingsAccessFor(user({ role: "superadmin" }))).toBeNull();
    expect(settingsAccessFor(user({ role: null }))).toBeNull();
    expect(settingsAccessFor(user({}))).toBeNull();
  });

  it("has no site in the access it returns", () => {
    expect(Object.keys(settingsAccessFor(user({ role: "ho" }))!).sort()).toEqual([
      "locationId",
      "role",
      "userId",
    ]);
  });
});

describe("canEditWorkRule", () => {
  it("lets HO edit the global row", () => {
    expect(canEditWorkRule(HO, globalTarget)).toBe(true);
  });

  it("never lets admin site edit the global row", () => {
    expect(canEditWorkRule(ADMIN_SITE, globalTarget)).toBe(false);
  });

  it("lets HO edit any location", () => {
    expect(canEditWorkRule(HO, locationTarget(LOCATION_A))).toBe(true);
    expect(canEditWorkRule(HO, locationTarget(LOCATION_B))).toBe(true);
  });

  it("lets admin site edit its own location only", () => {
    expect(canEditWorkRule(ADMIN_SITE, locationTarget(LOCATION_A))).toBe(true);
    expect(canEditWorkRule(ADMIN_SITE, locationTarget(LOCATION_B))).toBe(false);
  });

  it("denies a location target that has no id", () => {
    expect(canEditWorkRule(HO, locationTarget(null))).toBe(false);
    expect(canEditWorkRule(ADMIN_SITE, locationTarget(null))).toBe(false);
  });

  it("denies a site target, a level that no longer exists", () => {
    const site = { scope: "site", locationId: null } as unknown as WorkRuleAccessTarget;

    expect(canEditWorkRule(HO, site)).toBe(false);
    expect(canEditWorkRule(ADMIN_SITE, site)).toBe(false);
  });
});

describe("canViewWorkRule", () => {
  it("lets every role view the global row", () => {
    expect(canViewWorkRule(HO, globalTarget)).toBe(true);
    expect(canViewWorkRule(ADMIN_SITE, globalTarget)).toBe(true);
  });

  it("lets HO view any location", () => {
    expect(canViewWorkRule(HO, locationTarget(LOCATION_A))).toBe(true);
    expect(canViewWorkRule(HO, locationTarget(LOCATION_B))).toBe(true);
  });

  it("lets admin site view its own location only", () => {
    expect(canViewWorkRule(ADMIN_SITE, locationTarget(LOCATION_A))).toBe(true);
    expect(canViewWorkRule(ADMIN_SITE, locationTarget(LOCATION_B))).toBe(false);
  });

  it("denies a location target that has no id", () => {
    expect(canViewWorkRule(HO, locationTarget(null))).toBe(false);
    expect(canViewWorkRule(ADMIN_SITE, locationTarget(null))).toBe(false);
  });

  it("denies a site target, a level that no longer exists", () => {
    const site = { scope: "site", locationId: null } as unknown as WorkRuleAccessTarget;

    expect(canViewWorkRule(HO, site)).toBe(false);
    expect(canViewWorkRule(ADMIN_SITE, site)).toBe(false);
  });
});

describe("workRuleAccessTargetFor", () => {
  it("checks global with no id", () => {
    expect(workRuleAccessTargetFor({ scope: "global", locationId: null })).toEqual({
      scope: "global",
      locationId: null,
    });
  });

  it("checks a location by its id", () => {
    expect(workRuleAccessTargetFor({ scope: "location", locationId: LOCATION_A })).toEqual({
      scope: "location",
      locationId: LOCATION_A,
    });
  });

  it("lets an HO edit what it loaded, and an admin site only its own location", () => {
    const own = workRuleAccessTargetFor({ scope: "location", locationId: LOCATION_A });
    const other = workRuleAccessTargetFor({ scope: "location", locationId: LOCATION_B });

    expect(canEditWorkRule(HO, own)).toBe(true);
    expect(canEditWorkRule(HO, other)).toBe(true);
    expect(canEditWorkRule(ADMIN_SITE, own)).toBe(true);
    expect(canEditWorkRule(ADMIN_SITE, other)).toBe(false);
  });
});
