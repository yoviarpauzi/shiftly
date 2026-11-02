import type { UserScope } from "@/types/users";
import type { WorkerAccess } from "@/types/workers";

// Superadmin sees every worker. HO sees its own site. Admin site sees its own location, so the
// caller passes the site that holds that location. Anyone else gets null.
// Kept free of server-only so the rule can be tested directly.
export function workerAccessFor(
  user: UserScope,
  locationSiteId: string | null,
): WorkerAccess | null {
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

// The only write check for a worker's site and location. Callers load both rows first, then ask this.
export function canWriteWorker(
  access: WorkerAccess,
  target: { siteId: string; locationId: string },
): boolean {
  const siteOk = access.siteId === null || access.siteId === target.siteId;
  const locationOk = access.locationId === null || access.locationId === target.locationId;

  return siteOk && locationOk;
}
