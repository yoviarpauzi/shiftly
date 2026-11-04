import { isAllowedRole } from "@/lib/roles";
import type {
  LocationWorkRules,
  SettingsAccess,
  WorkRuleAccessTarget,
} from "@/types/settings";
import type { UserScope } from "@/types/users";

// Superadmin sees every site. HO sees its own site. Admin site sees its own location, so the
// caller passes the site that holds that location. Anyone else gets null.
// Kept free of server-only so the rule can be tested directly.
export function settingsAccessFor(
  user: UserScope,
  locationSiteId: string | null,
): SettingsAccess | null {
  if (!isAllowedRole(user.role)) {
    return null;
  }

  if (user.role === "superadmin") {
    return { userId: user.id, role: "superadmin", siteId: null, locationId: null };
  }

  if (user.role === "ho" && user.siteId && !user.locationId) {
    return { userId: user.id, role: "ho", siteId: user.siteId, locationId: null };
  }

  if (user.role === "admin_site" && user.locationId && locationSiteId) {
    return {
      userId: user.id,
      role: "admin_site",
      siteId: locationSiteId,
      locationId: user.locationId,
    };
  }

  return null;
}

// Everyone may read the global row. A site or location row is readable inside the user's own scope.
export function canViewWorkRule(access: SettingsAccess, target: WorkRuleAccessTarget): boolean {
  if (target.scope === "global") {
    return true;
  }

  if (access.role === "superadmin") {
    return true;
  }

  if (target.scope === "site") {
    return target.siteId !== null && target.siteId === access.siteId;
  }

  if (access.role === "admin_site") {
    return target.locationId !== null && target.locationId === access.locationId;
  }

  return target.locationSiteId !== null && target.locationSiteId === access.siteId;
}

// The only write check for work rules. Callers load the site or location first, then ask this.
// Global is superadmin only. Site is superadmin or the HO of that site. Location is also open to
// the admin site of that location.
export function canEditWorkRule(access: SettingsAccess, target: WorkRuleAccessTarget): boolean {
  if (access.role === "superadmin") {
    return true;
  }

  if (target.scope === "global") {
    return false;
  }

  if (target.scope === "site") {
    return access.role === "ho" && target.siteId !== null && target.siteId === access.siteId;
  }

  if (access.role === "ho") {
    return target.locationSiteId !== null && target.locationSiteId === access.siteId;
  }

  return (
    access.role === "admin_site" &&
    target.locationId !== null &&
    target.locationId === access.locationId
  );
}

// The access target for a level loaded by workRulesFor, in the shape the actions check, so the
// page shows Save only where the action would accept it. A location is checked by the site that
// owns it, as read from the database.
export function workRuleAccessTargetFor(
  rules: Pick<LocationWorkRules, "scope" | "siteId" | "locationId">,
): WorkRuleAccessTarget {
  if (rules.scope === "site") {
    return { scope: "site", siteId: rules.siteId, locationId: null, locationSiteId: null };
  }

  if (rules.scope === "location") {
    return {
      scope: "location",
      siteId: null,
      locationId: rules.locationId,
      locationSiteId: rules.siteId,
    };
  }

  return { scope: "global", siteId: null, locationId: null, locationSiteId: null };
}
