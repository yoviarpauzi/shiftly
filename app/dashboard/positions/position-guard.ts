import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { positionAccessFor } from "./position-access";
import { findLocationSiteId } from "./positions";

// Position pages and actions: superadmin, HO, and admin site. Other roles get notFound(), like requireSuperadmin.
// An admin site user is scoped by location, so its site is read from that location.
export async function requirePositionManager() {
  const user = await requireUser();
  const locationSiteId =
    user.role === "admin_site" && user.locationId
      ? await findLocationSiteId(user.locationId)
      : null;
  const access = positionAccessFor(user, locationSiteId);

  if (!access) {
    notFound();
  }

  return access;
}
