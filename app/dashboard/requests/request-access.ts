import type { RequestAccess } from "@/types/requests";
import type { UserScope } from "@/types/users";

// HO sees every request. Admin site sees the requests of its own location. Anyone else gets null,
// including an HO that carries a location and an admin site without one.
// Kept free of server-only so the rule can be tested directly.
export function requestAccessFor(user: UserScope): RequestAccess | null {
  if (user.role === "ho" && !user.locationId) {
    return { locationId: null };
  }

  if (user.role === "admin_site" && user.locationId) {
    return { locationId: user.locationId };
  }

  return null;
}

// The only write check for a location. Callers load the location row first, then ask this.
export function canWriteToLocation(access: RequestAccess, target: { id: string }): boolean {
  return access.locationId === null || access.locationId === target.id;
}

// Approving or rejecting is for HO only, the same actor requestAccessFor gives every location.
export function canDecideRequest(user: UserScope): boolean {
  return user.role === "ho" && !user.locationId;
}
