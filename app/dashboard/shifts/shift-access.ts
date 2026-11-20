import type { ShiftAccess } from "@/types/shifts";
import type { UserScope } from "@/types/users";

// HO sees every location. Admin site sees its own location only. Anyone else gets null, including
// an HO that carries a location and an admin site without one.
// Kept free of server-only so the rule can be tested directly.
export function shiftAccessFor(user: UserScope): ShiftAccess | null {
  if (user.role === "ho" && !user.locationId) {
    return { locationId: null };
  }

  if (user.role === "admin_site" && user.locationId) {
    return { locationId: user.locationId };
  }

  return null;
}

// The only write check for a location. Callers load the location row first, then ask this.
export function canWriteToLocation(access: ShiftAccess, target: { id: string }): boolean {
  return access.locationId === null || access.locationId === target.id;
}
