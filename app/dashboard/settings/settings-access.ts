import { isAllowedRole } from "@/lib/roles";
import type {
  LocationWorkRules,
  SettingsAccess,
  WorkRuleAccessTarget,
} from "@/types/settings";
import type { UserScope } from "@/types/users";

// HO reaches every location and carries none of its own. Admin site reaches its own location.
// Anyone else gets null, including an HO that carries a location and an admin site without one.
// Kept free of server-only so the rule can be tested directly.
export function settingsAccessFor(user: UserScope): SettingsAccess | null {
  if (!isAllowedRole(user.role)) {
    return null;
  }

  if (user.role === "ho" && !user.locationId) {
    return { userId: user.id, role: "ho", locationId: null };
  }

  if (user.role === "admin_site" && user.locationId) {
    return { userId: user.id, role: "admin_site", locationId: user.locationId };
  }

  return null;
}

// Everyone may read the global row. A location row is readable by HO and by the admin site of
// that location.
export function canViewWorkRule(access: SettingsAccess, target: WorkRuleAccessTarget): boolean {
  if (target.scope === "global") {
    return true;
  }

  if (target.scope !== "location" || target.locationId === null) {
    return false;
  }

  return access.role === "ho" || target.locationId === access.locationId;
}

// The only write check for work rules. Callers load the location first, then ask this.
// HO writes the global row and any location. Admin site writes its own location only.
export function canEditWorkRule(access: SettingsAccess, target: WorkRuleAccessTarget): boolean {
  if (target.scope === "global") {
    return access.role === "ho";
  }

  if (target.scope !== "location" || target.locationId === null) {
    return false;
  }

  return access.role === "ho" || target.locationId === access.locationId;
}

// The access target for a level loaded by workRulesFor, in the shape the actions check, so the
// page shows Save only where the action would accept it.
export function workRuleAccessTargetFor(
  rules: Pick<LocationWorkRules, "scope" | "locationId">,
): WorkRuleAccessTarget {
  return rules.scope === "location"
    ? { scope: "location", locationId: rules.locationId }
    : { scope: "global", locationId: null };
}
