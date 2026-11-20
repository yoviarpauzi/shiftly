import type { DepartmentAccess } from "@/types/departments";
import type { UserScope } from "@/types/users";

// HO sees every location. Admin site sees its own location only. Anyone else gets null, including
// an HO that carries a location and an admin site without one.
// Kept free of server-only so the rule can be tested directly.
export function departmentAccessFor(user: UserScope): DepartmentAccess | null {
  if (user.role === "ho" && !user.locationId) {
    return { locationId: null };
  }

  if (user.role === "admin_site" && user.locationId) {
    return { locationId: user.locationId };
  }

  return null;
}

// The only write check for a location id. Callers load the location row first, then ask this.
export function canWriteToLocation(
  access: DepartmentAccess,
  location: { id: string },
): boolean {
  return access.locationId === null || access.locationId === location.id;
}
