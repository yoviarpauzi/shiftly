import type { PositionAccess } from "@/types/positions";
import type { UserScope } from "@/types/users";

// Positions are global master data. HO may manage them, and so may an admin site user, which keeps
// the reach it had before: any position. HO must have no location of its own, and admin site must
// have one. Anyone else gets null.
// Kept free of server-only so the rule can be tested directly.
export function positionAccessFor(user: UserScope): PositionAccess | null {
  if (user.role === "ho" && !user.locationId) {
    return { role: "ho" };
  }

  if (user.role === "admin_site" && user.locationId) {
    return { role: "admin_site" };
  }

  return null;
}
