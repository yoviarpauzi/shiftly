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
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import { clampPage, escapeLikePattern } from "@/lib/pagination";
import { sortTerms } from "@/lib/sort";
import type { SortCriterion } from "@/types/sort";
import type {
  SiteListParams,
  SitePage,
  SiteSortColumn,
  SiteStatus,
} from "@/types/sites";

const DEFAULT_SORT: SortCriterion<SiteSortColumn>[] = [
  { column: "name", direction: "asc" },
];

// Each sortable column maps to a fixed expression. URL input only picks a key from this map.
const SITE_SORT_EXPRESSIONS: Record<SiteSortColumn, SQLWrapper> = {
  name: site.name,
  locations: count(location.id),
  status: sql`(${site.deletedAt} is not null)`,
};

// Matches name case-insensitively. An empty query matches every site in the status.
function siteFilter(query: string, status: SiteStatus): SQL | undefined {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    status === "active" ? isNull(site.deletedAt) : undefined,
    status === "deleted" ? isNotNull(site.deletedAt) : undefined,
    query ? ilike(site.name, pattern) : undefined,
  );
}

export async function listSites({
  page,
  pageSize,
  query,
  status,
  sort,
}: SiteListParams): Promise<SitePage> {
  const filter = siteFilter(query, status);
  const criteria = sort.length > 0 ? sort : DEFAULT_SORT;

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
      code: site.code,
      locationCount: count(location.id),
      deletedAt: site.deletedAt,
    })
    .from(site)
    .leftJoin(
      location,
      and(eq(location.siteId, site.id), isNull(location.deletedAt)),
    )
    .where(filter)
    .groupBy(site.id, site.name, site.code, site.deletedAt)
    .orderBy(...sortTerms(criteria, SITE_SORT_EXPRESSIONS), asc(site.id))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return { rows, total, page: currentPage, pageSize };
}
