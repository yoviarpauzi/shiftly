import "server-only";
import { eq } from "drizzle-orm";
import { location } from "@/database/schema/location-schema";
import { db } from "@/lib/db";

// The site that holds a location. Admin site users reach shifts through it.
export async function findLocationSiteId(locationId: string): Promise<string | null> {
  const [row] = await db
    .select({ siteId: location.siteId })
    .from(location)
    .where(eq(location.id, locationId));

  return row?.siteId ?? null;
}
