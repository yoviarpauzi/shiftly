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
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import {
  clampPage,
  escapeLikePattern,
  type PageParams,
} from "@/lib/pagination";
import type { SiteStatus } from "./site-rules";

export type SiteRow = {
  id: string;
  name: string;
  locationCount: number;
  deletedAt: Date | null;
};

export type SitePage = {
  rows: SiteRow[];
  total: number;
  page: number;
  pageSize: number;
};

type SiteListParams = PageParams & { status: SiteStatus };

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
}: SiteListParams): Promise<SitePage> {
  const filter = siteFilter(query, status);

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
      deletedAt: site.deletedAt,
    })
    .from(site)
    .leftJoin(
      location,
      and(eq(location.siteId, site.id), isNull(location.deletedAt)),
    )
    .where(filter)
    .groupBy(site.id, site.name, site.deletedAt)
    .orderBy(asc(site.name), asc(site.id))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return { rows, total, page: currentPage, pageSize };
}
