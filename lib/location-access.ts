import type { LocationAccess } from "@/types/locations";
import type { UserScope } from "@/types/users";

// Superadmin sees every site. HO sees its own site and nothing else. Anyone else gets null.
// Kept free of server-only so the rule can be tested directly.
export function locationAccessFor(user: UserScope): LocationAccess | null {
  if (user.role === "superadmin") {
    return { siteId: null };
  }

  if (user.role === "ho" && user.siteId && !user.locationId) {
    return { siteId: user.siteId };
  }

  return null;
}

// HO stays active only while its site is active, and admin site only while its location is.
// A deleted site or location therefore cuts off every user assigned to it, at sign-in and on each request.
export function isScopeActive(
  user: UserScope,
  activity: { siteActive: boolean; locationActive: boolean },
): boolean {
  if (user.role === "superadmin") {
    return true;
  }

  if (user.role === "ho") {
    return Boolean(user.siteId) && activity.siteActive;
  }

  if (user.role === "admin_site") {
    return Boolean(user.locationId) && activity.locationActive;
  }

  return false;
}

// HO always writes to its own site, so a siteId sent by the client is ignored for HO.
export function resolveSiteId(access: LocationAccess, requestedSiteId: string): string {
  return access.siteId ?? requestedSiteId;
}
