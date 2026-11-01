import type { PositionAccess } from "@/types/positions";
import type { UserScope } from "@/types/users";

// Superadmin sees every site. HO sees its own site. Admin site sees the site that holds its
// location, so the caller passes that site id after loading the location. Anyone else gets null.
// Kept free of server-only so the rule can be tested directly.
export function positionAccessFor(
  user: UserScope,
  locationSiteId: string | null,
): PositionAccess | null {
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
export function canWriteToSite(access: PositionAccess, siteId: string): boolean {
  return access.siteId === null || access.siteId === siteId;
}
