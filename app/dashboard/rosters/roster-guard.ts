import "server-only";
import { notFound } from "next/navigation";
import { findLocationSiteId } from "@/app/dashboard/positions/positions";
import { requireUser } from "@/lib/session";
import type { RequestAccess } from "@/types/requests";
import { rosterAccessFor } from "./roster-access";

// Roster pages and actions: superadmin, HO, and admin site. Other roles get notFound(), like
// requireRequestUser. An admin site user is scoped by location, so its site is read from that
// location.
export async function requireRosterUser(): Promise<{
  user: { id: string; name: string };
  access: RequestAccess;
}> {
  const user = await requireUser();
  const locationSiteId =
    user.role === "admin_site" && user.locationId
      ? await findLocationSiteId(user.locationId)
      : null;
  const access = rosterAccessFor(user, locationSiteId);

  if (!access) {
    notFound();
  }

  return { user: { id: user.id, name: user.name }, access };
}
