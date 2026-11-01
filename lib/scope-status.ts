import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import type { UserScope } from "@/types/users";

// HO stays active only while its site is active, and admin site only while its location is.
// A deleted site or location therefore cuts off every user assigned to it, at sign-in and on each request.
export function isScopeActive(
  user: UserScope,
  activity: { siteActive: boolean; locationActive: boolean },
): boolean {
  if (user.role === "superadmin") {
    return true;
  }

  if (user.role === "ho") {
    return Boolean(user.siteId) && activity.siteActive;
  }

  if (user.role === "admin_site") {
    return Boolean(user.locationId) && activity.locationActive;
  }

  return false;
}

// Reads whether the user's assigned site or location is still active, then applies the rule.
export async function userScopeIsActive(user: UserScope): Promise<boolean> {
  const [activeSite] = user.siteId
    ? await db
        .select({ id: site.id })
        .from(site)
        .where(and(eq(site.id, user.siteId), isNull(site.deletedAt)))
    : [];

  const [activeLocation] = user.locationId
    ? await db
        .select({ id: location.id })
        .from(location)
        .where(and(eq(location.id, user.locationId), isNull(location.deletedAt)))
    : [];

  return isScopeActive(user, {
    siteActive: Boolean(activeSite),
    locationActive: Boolean(activeLocation),
  });
}
