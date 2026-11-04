import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { findLocationSiteId } from "@/app/dashboard/positions/positions";
import type { RequestAccess, RequestActor } from "@/types/requests";
import { requestAccessFor } from "./request-access";

// Request pages and actions: superadmin, HO, and admin site. Other roles get notFound(), like requireShiftManager.
// An admin site user is scoped by location, so its site is read from that location.
export async function requireRequestUser(): Promise<{
  user: RequestActor;
  access: RequestAccess;
}> {
  const user = await requireUser();
  const locationSiteId =
    user.role === "admin_site" && user.locationId
      ? await findLocationSiteId(user.locationId)
      : null;
  const access = requestAccessFor(user, locationSiteId);

  if (!access) {
    notFound();
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      role: user.role ?? null,
      siteId: user.siteId,
      locationId: user.locationId,
    },
    access,
  };
}
