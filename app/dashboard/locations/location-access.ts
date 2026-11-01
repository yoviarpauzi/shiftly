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

// HO always writes to its own site, so a siteId sent by the client is ignored for HO.
export function resolveSiteId(access: LocationAccess, requestedSiteId: string): string {
  return access.siteId ?? requestedSiteId;
}
