import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import type { DashboardRole } from "@/types/dashboard";
import type { RequestAccess } from "@/types/requests";
import { dashboardAccessFor } from "./dashboard-access";

// The dashboard is open to HO and admin site. Anyone else gets notFound(), as in the request pages.
export async function requireDashboardUser(): Promise<{
  role: DashboardRole;
  access: RequestAccess;
}> {
  const dashboard = dashboardAccessFor(await requireUser());

  if (!dashboard) {
    notFound();
  }

  return dashboard;
}
