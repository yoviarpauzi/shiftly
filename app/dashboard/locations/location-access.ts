import type { LocationAccess } from "@/types/locations";
import type { UserScope } from "@/types/users";

// Only HO manages locations, and only an HO without a location of its own. Anyone else gets null.
// Kept free of server-only so the rule can be tested directly.
export function locationAccessFor(user: UserScope): LocationAccess | null {
  if (user.role === "ho" && !user.locationId) {
    return { role: "ho" };
  }

  return null;
}
