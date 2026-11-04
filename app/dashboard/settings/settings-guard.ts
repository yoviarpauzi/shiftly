import "server-only";
import { requireUser } from "@/lib/session";
import type { SettingsAccess } from "@/types/settings";
import { findLocationSiteId } from "../positions/positions";
import { settingsAccessFor } from "./settings-access";

// Every signed-in user may open Settings to change their password. The work rules need a scope,
// so a user without one gets null (no work-rules section) rather than notFound().
// An admin site user is scoped by location, so its site is read from that location.
export async function requireSettingsAccess(): Promise<SettingsAccess | null> {
  const user = await requireUser();
  const locationSiteId =
    user.role === "admin_site" && user.locationId
      ? await findLocationSiteId(user.locationId)
      : null;

  return settingsAccessFor(user, locationSiteId);
}
