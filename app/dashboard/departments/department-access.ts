import type { DepartmentAccess } from "@/types/departments";
import type { UserScope } from "@/types/users";

// Superadmin sees every location. HO sees the locations of its own site. Admin site sees
// its own location only and takes its scope from the location, so its siteId is ignored.
// Anyone else gets null. Kept free of server-only so the rule can be tested directly.
export function departmentAccessFor(user: UserScope): DepartmentAccess | null {
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

// The only write check for a location id. Callers load the location row first, then ask this.
export function canWriteToLocation(
  access: DepartmentAccess,
  location: { id: string; siteId: string },
): boolean {
  if (access.locationId) {
    return location.id === access.locationId;
  }

  if (access.siteId) {
    return location.siteId === access.siteId;
  }

  return true;
}
