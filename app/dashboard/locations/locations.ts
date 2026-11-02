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
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import { notFound } from "next/navigation";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import { clampPage, escapeLikePattern } from "@/lib/pagination";
import { sortTerms } from "@/lib/sort";
import type { SortCriterion } from "@/types/sort";
import type {
  LocationAccess,
  LocationListParams,
  LocationPage,
  LocationSortColumn,
  LocationStatus,
  SiteChoice,
} from "@/types/locations";

const DEFAULT_SORT: SortCriterion<LocationSortColumn>[] = [
  { column: "site", direction: "asc" },
  { column: "name", direction: "asc" },
];

// Each sortable column maps to a fixed expression. URL input only picks a key from this map.
const LOCATION_SORT_EXPRESSIONS: Record<LocationSortColumn, SQLWrapper> = {
  name: location.name,
  site: site.name,
  status: sql`(${location.deletedAt} is not null)`,
};

// Superadmin sees every location. HO sees only locations in its own site.
export function locationScopeFilter(access: LocationAccess): SQL | undefined {
  return access.siteId ? eq(location.siteId, access.siteId) : undefined;
}

// Matches name case-insensitively. An empty query matches every location in the status.
function locationFilter(
  access: LocationAccess,
  query: string,
  status: LocationStatus,
  siteId: string | null,
): SQL | undefined {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    locationScopeFilter(access),
    siteId ? eq(location.siteId, siteId) : undefined,
    status === "active" ? isNull(location.deletedAt) : undefined,
    status === "deleted" ? isNotNull(location.deletedAt) : undefined,
    query ? ilike(location.name, pattern) : undefined,
  );
}

export async function listLocations(
  access: LocationAccess,
  { page, pageSize, query, status, siteId, sort }: LocationListParams,
): Promise<LocationPage> {
  const filter = locationFilter(access, query, status, siteId);
  const criteria = sort.length > 0 ? sort : DEFAULT_SORT;

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
      timezone: location.timezone,
      deletedAt: location.deletedAt,
    })
    .from(location)
    .innerJoin(site, eq(site.id, location.siteId))
    .where(filter)
    .orderBy(...sortTerms(criteria, LOCATION_SORT_EXPRESSIONS), asc(location.id))
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
