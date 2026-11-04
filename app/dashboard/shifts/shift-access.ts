import type { ShiftAccess } from "@/types/shifts";
import type { UserScope } from "@/types/users";

// Superadmin sees every location. HO sees the locations of its own site. Admin site sees its own
// location only. Anyone else gets null. Kept free of server-only so the rule can be tested directly.
export function shiftAccessFor(user: UserScope): ShiftAccess | null {
  if (user.role === "superadmin") {
    return { siteId: null, locationId: null };
  }

  if (user.role === "ho" && user.siteId && !user.locationId) {
    return { siteId: user.siteId, locationId: null };
  }

  if (user.role === "admin_site" && user.locationId) {
    return { siteId: null, locationId: user.locationId };
  }

  return null;
}

// The only write check for a location. Callers load the location row first, then ask this.
export function canWriteToLocation(
  access: ShiftAccess,
  target: { id: string; siteId: string },
): boolean {
  if (access.locationId !== null) {
    return access.locationId === target.id;
  }

  return access.siteId === null || access.siteId === target.siteId;
}
