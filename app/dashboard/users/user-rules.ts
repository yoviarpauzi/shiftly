import type { AppRole } from "@/types/roles";
import type { ManagedTarget, UserAccess } from "@/types/users";

export const USER_NOT_FOUND_MESSAGE = "User not found";
export const LOCATION_OUT_OF_SCOPE_MESSAGE = "Choose a location in your site";
export const ROLE_LOCKED_MESSAGE = "You cannot change this user's role";
export const SELF_ROLE_MESSAGE = "You cannot change your own role";
export const SELF_DEACTIVATE_MESSAGE = "You cannot deactivate your own account";
export const LAST_SUPERADMIN_MESSAGE =
  "The last active superadmin cannot be deactivated or demoted";

// A banned superadmin is not counted as active, so removing it never leaves zero.
function isLastActiveSuperadmin(target: ManagedTarget, activeSuperadmins: number): boolean {
  return target.role === "superadmin" && !target.banned && activeSuperadmins <= 1;
}

// Returns the refusal message, or null when the change is allowed.
export function guardRoleChange(
  access: UserAccess,
  target: ManagedTarget,
  nextRole: AppRole,
  activeSuperadmins: number,
): string | null {
  if (target.role === nextRole) return null;
  if (access.role !== "superadmin") return ROLE_LOCKED_MESSAGE;
  if (target.id === access.id) return SELF_ROLE_MESSAGE;
  if (isLastActiveSuperadmin(target, activeSuperadmins)) return LAST_SUPERADMIN_MESSAGE;
  return null;
}

export function guardDeactivation(
  access: UserAccess,
  target: ManagedTarget,
  activeSuperadmins: number,
): string | null {
  if (target.id === access.id) return SELF_DEACTIVATE_MESSAGE;
  if (isLastActiveSuperadmin(target, activeSuperadmins)) return LAST_SUPERADMIN_MESSAGE;
  return null;
}
