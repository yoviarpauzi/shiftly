import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import { dateInZone } from "@/lib/indonesia-date";
import type { DashboardScope, ScopeLocation, ScopeZone } from "@/types/dashboard";
import type { RequestAccess } from "@/types/requests";

// Groups the locations by time zone. A zone has its own today, because a location in WITA is
// already on the next date while one in WIB is not. Zones keep the order their first location
// appears in, so the caller's sort order carries through.
export function buildScope(
  access: RequestAccess,
  locations: ScopeLocation[],
  now: Date = new Date(),
): DashboardScope {
  const zones = new Map<ScopeLocation["timezone"], ScopeZone>();

  for (const row of locations) {
    const zone = zones.get(row.timezone);

    if (zone) {
      zone.locationIds.push(row.id);
    } else {
      zones.set(row.timezone, {
        timezone: row.timezone,
        today: dateInZone(row.timezone, now),
        locationIds: [row.id],
      });
    }
  }

  return { access, locations, zones: [...zones.values()] };
}

// The active locations the actor can see, each with its active site. Superadmin sees all, HO the
// locations of its site, and admin site its own location.
export async function dashboardScopeFor(access: RequestAccess): Promise<DashboardScope> {
  const locations = await db
    .select({
      id: location.id,
      name: location.name,
      siteId: location.siteId,
      siteName: site.name,
      timezone: location.timezone,
    })
    .from(location)
    .innerJoin(site, eq(site.id, location.siteId))
    .where(
      and(
        isNull(location.deletedAt),
        isNull(site.deletedAt),
        access.siteId ? eq(location.siteId, access.siteId) : undefined,
        access.locationId ? eq(location.id, access.locationId) : undefined,
      ),
    )
    .orderBy(asc(site.name), asc(location.name), asc(location.id));

  return buildScope(access, locations);
}
