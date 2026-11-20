import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { location } from "@/database/schema/location-schema";
import { db } from "@/lib/db";
import type { UserScope } from "@/types/users";

// HO sees every location, so it has none assigned. Admin site stays active only while its location is.
// A deleted location therefore cuts off every admin site assigned to it, at sign-in and on each request.
export function isScopeActive(user: UserScope, activity: { locationActive: boolean }): boolean {
  if (user.role === "ho") {
    return !user.locationId;
  }

  if (user.role === "admin_site") {
    return Boolean(user.locationId) && activity.locationActive;
  }

  return false;
}

// Reads whether the user's assigned location is still active, then applies the rule.
export async function userScopeIsActive(user: UserScope): Promise<boolean> {
  const [activeLocation] = user.locationId
    ? await db
        .select({ id: location.id })
        .from(location)
        .where(and(eq(location.id, user.locationId), isNull(location.deletedAt)))
    : [];

  return isScopeActive(user, { locationActive: Boolean(activeLocation) });
}
