import "server-only";
import {
  and,
  asc,
  count,
  eq,
  ilike,
  isNotNull,
  isNull,
  type SQL,
} from "drizzle-orm";
import { notFound } from "next/navigation";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import { clampPage, escapeLikePattern } from "@/lib/pagination";
import type {
  LocationAccess,
  LocationListParams,
  LocationPage,
  LocationStatus,
  SiteChoice,
} from "@/types/locations";

// Superadmin sees every location. HO sees only locations in its own site.
export function locationScopeFilter(access: LocationAccess): SQL | undefined {
  return access.siteId ? eq(location.siteId, access.siteId) : undefined;
}

// Matches name case-insensitively. An empty query matches every location in the status.
function locationFilter(
  access: LocationAccess,
  query: string,
  status: LocationStatus,
): SQL | undefined {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    locationScopeFilter(access),
    status === "active" ? isNull(location.deletedAt) : undefined,
    status === "deleted" ? isNotNull(location.deletedAt) : undefined,
    query ? ilike(location.name, pattern) : undefined,
  );
}

export async function listLocations(
  access: LocationAccess,
  { page, pageSize, query, status }: LocationListParams,
): Promise<LocationPage> {
  const filter = locationFilter(access, query, status);

  // Counted from the location table alone, so the site join does not inflate the total.
  const [{ total }] = await db
    .select({ total: count() })
    .from(location)
    .where(filter);

  const currentPage = clampPage(page, total, pageSize);

  const rows = await db
    .select({
      id: location.id,
      name: location.name,
      siteId: location.siteId,
      siteName: site.name,
      deletedAt: location.deletedAt,
    })
    .from(location)
    .innerJoin(site, eq(site.id, location.siteId))
    .where(filter)
    .orderBy(asc(site.name), asc(location.name), asc(location.id))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return { rows, total, page: currentPage, pageSize };
}

// Superadmin picks from every active site. HO gets its own site as fixed text.
export async function siteChoiceFor(access: LocationAccess): Promise<SiteChoice> {
  if (access.siteId) {
    const [own] = await db
      .select({ id: site.id, name: site.name })
      .from(site)
      .where(eq(site.id, access.siteId));

    if (!own) {
      notFound();
    }

    return { mode: "fixed", site: own };
  }

  const sites = await db
    .select({ id: site.id, name: site.name })
    .from(site)
    .where(isNull(site.deletedAt))
    .orderBy(asc(site.name), asc(site.id));

  return { mode: "pick", sites };
}
