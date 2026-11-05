import "server-only";
import { notFound } from "next/navigation";
import { requireRequestUser } from "@/app/dashboard/requests/request-guard";
import type { DashboardRole } from "@/types/dashboard";
import type { RequestAccess } from "@/types/requests";

const DASHBOARD_ROLES: readonly string[] = ["superadmin", "ho", "admin_site"];

function isDashboardRole(role: string | null): role is DashboardRole {
  return role !== null && DASHBOARD_ROLES.includes(role);
}

// The dashboard is open to the same roles as requests: superadmin, HO, and admin site. The access
// rule is requireRequestUser's, so anyone without access already gets notFound() there. This only
// narrows the role for the page.
export async function requireDashboardUser(): Promise<{
  role: DashboardRole;
  access: RequestAccess;
}> {
  const { user, access } = await requireRequestUser();

  if (!isDashboardRole(user.role)) {
    notFound();
  }

  return { role: user.role, access };
}
