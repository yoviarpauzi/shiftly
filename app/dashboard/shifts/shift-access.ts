import type { ShiftAccess } from "@/types/shifts";
import type { UserScope } from "@/types/users";

// Superadmin sees every site. HO sees its own site. Admin site sees the site that holds its
// location, so the caller passes that site id after loading the location. Anyone else gets null.
// Kept free of server-only so the rule can be tested directly.
export function shiftAccessFor(
  user: UserScope,
  locationSiteId: string | null,
): ShiftAccess | null {
  if (user.role === "superadmin") {
    return { siteId: null };
  }

  if (user.role === "ho" && user.siteId && !user.locationId) {
    return { siteId: user.siteId };
  }

  if (user.role === "admin_site" && user.locationId && locationSiteId) {
    return { siteId: locationSiteId };
  }

  return null;
}

// The only write check for a site id. Callers load the site row first, then ask this.
export function canWriteToSite(access: ShiftAccess, siteId: string): boolean {
  return access.siteId === null || access.siteId === siteId;
}
