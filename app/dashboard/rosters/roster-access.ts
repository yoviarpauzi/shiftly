import type { RequestAccess } from "@/types/requests";
import type { UserScope } from "@/types/users";

import { canWriteToLocation, requestAccessFor } from "../requests/request-access";

// The Roster menu has the same scope as the Request menu: HO sees every location and admin site its
// own location. Both functions delegate, so the two menus cannot drift apart. Kept free of
// server-only so the rule can be tested directly.
export function rosterAccessFor(user: UserScope): RequestAccess | null {
  return requestAccessFor(user);
}

// The only check for a roster's location. Callers load the location row first, then ask this.
export function canAccessRosterLocation(
  access: RequestAccess,
  location: { id: string },
): boolean {
  return canWriteToLocation(access, location);
}
