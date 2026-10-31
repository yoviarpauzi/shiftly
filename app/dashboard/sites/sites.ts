import "server-only";
import { and, asc, count, eq, ilike, isNull, type SQL } from "drizzle-orm";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import { clampPage, escapeLikePattern, type PageParams } from "@/lib/pagination";

export type SiteRow = {
  id: string;
  name: string;
  locationCount: number;
};

export type SitePage = {
  rows: SiteRow[];
  total: number;
  page: number;
  pageSize: number;
};

// Matches name case-insensitively. An empty query matches every active site.
function activeSitesFilter(query: string): SQL | undefined {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    isNull(site.deletedAt),
    query ? ilike(site.name, pattern) : undefined,
  );
}

export async function listSites({
  page,
  pageSize,
  query,
}: PageParams): Promise<SitePage> {
  const filter = activeSitesFilter(query);

  // Counted from the site table alone, so the location join does not inflate the total.
  const [{ total }] = await db
    .select({ total: count() })
    .from(site)
    .where(filter);

  const currentPage = clampPage(page, total, pageSize);

  const rows = await db
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
    .where(filter)
    .groupBy(site.id, site.name)
    .orderBy(asc(site.name), asc(site.id))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return { rows, total, page: currentPage, pageSize };
}
