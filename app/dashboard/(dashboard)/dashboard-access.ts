import { requestAccessFor } from "@/app/dashboard/requests/request-access";
import type { DashboardRole } from "@/types/dashboard";
import type { RequestAccess } from "@/types/requests";
import type { UserScope } from "@/types/users";

// The dashboard is open to the same actors as requests: an HO without a location (every location)
// and an admin site with one (its own). Anyone else, including an HO that carries a location and
// an admin site without one, gets null. Kept free of server-only so the rule can be tested directly.
export function dashboardAccessFor(
  user: UserScope,
): { role: DashboardRole; access: RequestAccess } | null {
  const access = requestAccessFor(user);

  if (!access || (user.role !== "ho" && user.role !== "admin_site")) {
    return null;
  }

  return { role: user.role, access };
}
