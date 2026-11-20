import type { UserScope } from "@/types/users";
import type { WorkerAccess } from "@/types/workers";

// HO sees every worker and must have no location of its own. Admin site sees the workers of its own
// location, so it must have one. Anyone else gets null.
// Kept free of server-only so the rule can be tested directly.
export function workerAccessFor(user: UserScope): WorkerAccess | null {
  if (user.role === "ho" && !user.locationId) {
    return { locationId: null };
  }

  if (user.role === "admin_site" && user.locationId) {
    return { locationId: user.locationId };
  }

  return null;
}

// The only write check for a worker's location. Callers load the location row first, then ask this.
export function canWriteWorker(access: WorkerAccess, target: { locationId: string }): boolean {
  return access.locationId === null || access.locationId === target.locationId;
}
