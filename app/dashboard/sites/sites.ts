import "server-only";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";

export type SiteRow = {
  id: string;
  name: string;
  locationCount: number;
};

export async function listSites(): Promise<SiteRow[]> {
  return db
    .select({
      id: site.id,
      name: site.name,
      locationCount: count(location.id),
    })
    .from(site)
    .leftJoin(
      location,
      and(eq(location.siteId, site.id), isNull(location.deletedAt)),
    )
    .where(isNull(site.deletedAt))
    .groupBy(site.id, site.name)
    .orderBy(asc(site.name));
}
