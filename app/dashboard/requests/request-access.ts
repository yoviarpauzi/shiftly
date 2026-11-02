import type { RequestAccess } from "@/types/requests";
import type { UserScope } from "@/types/users";

// Superadmin sees every request. HO sees the requests of its own site. Admin site sees the requests
// of its own location, so the caller passes the site that holds that location after loading it.
// Anyone else gets null. Kept free of server-only so the rule can be tested directly.
export function requestAccessFor(
  user: UserScope,
  locationSiteId: string | null,
): RequestAccess | null {
  if (user.role === "superadmin") {
    return { siteId: null, locationId: null };
  }

  if (user.role === "ho" && user.siteId && !user.locationId) {
    return { siteId: user.siteId, locationId: null };
  }

  if (user.role === "admin_site" && user.locationId && locationSiteId) {
    return { siteId: locationSiteId, locationId: user.locationId };
  }

  return null;
}

// The only write check for a location. Callers load the location row first, then ask this.
export function canWriteToLocation(
  access: RequestAccess,
  target: { id: string; siteId: string },
): boolean {
  if (access.siteId !== null && access.siteId !== target.siteId) {
    return false;
  }

  return access.locationId === null || access.locationId === target.id;
}

// Approving or rejecting is for superadmin and for HO of the request's own site.
export function canDecideRequest(user: UserScope, request: { siteId: string }): boolean {
  if (user.role === "superadmin") {
    return true;
  }

  return (
    user.role === "ho" &&
    !!user.siteId &&
    !user.locationId &&
    user.siteId === request.siteId
  );
}
