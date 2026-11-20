import type { AppRole } from "@/types/roles";
import type { ManagedTarget, UserAccess } from "@/types/users";

export const USER_NOT_FOUND_MESSAGE = "User not found";
export const SELF_ROLE_MESSAGE = "You cannot change your own role";
export const SELF_DEACTIVATE_MESSAGE = "You cannot deactivate your own account";
export const LAST_HO_MESSAGE = "The last active HO cannot be deactivated or demoted";

// A banned HO is not counted as active, so removing it never leaves zero.
function isLastActiveHo(target: ManagedTarget, activeHos: number): boolean {
  return target.role === "ho" && !target.banned && activeHos <= 1;
}

// Returns the refusal message, or null when the change is allowed.
export function guardRoleChange(
  access: UserAccess,
  target: ManagedTarget,
  nextRole: AppRole,
  activeHos: number,
): string | null {
  if (target.role === nextRole) return null;
  if (target.id === access.id) return SELF_ROLE_MESSAGE;
  if (isLastActiveHo(target, activeHos)) return LAST_HO_MESSAGE;
  return null;
}

export function guardDeactivation(
  access: UserAccess,
  target: ManagedTarget,
  activeHos: number,
): string | null {
  if (target.id === access.id) return SELF_DEACTIVATE_MESSAGE;
  if (isLastActiveHo(target, activeHos)) return LAST_HO_MESSAGE;
  return null;
}
