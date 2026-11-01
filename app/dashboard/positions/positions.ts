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
import { position } from "@/database/schema/position-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import { clampPage, escapeLikePattern } from "@/lib/pagination";
import { sortTerms } from "@/lib/sort";
import type { SiteChoice } from "@/types/locations";
import type {
  PositionAccess,
  PositionListParams,
  PositionPage,
  PositionSortColumn,
  PositionStatus,
} from "@/types/positions";
import type { SortCriterion } from "@/types/sort";

const DEFAULT_SORT: SortCriterion<PositionSortColumn>[] = [
  { column: "site", direction: "asc" },
  { column: "name", direction: "asc" },
];

// Each sortable column maps to a fixed expression. URL input only picks a key from this map.
const POSITION_SORT_EXPRESSIONS: Record<PositionSortColumn, SQLWrapper> = {
  name: position.name,
  site: site.name,
  status: sql`(${position.deletedAt} is not null)`,
};

// Superadmin sees every position. HO and admin site see the positions of their own site.
export function positionScopeFilter(access: PositionAccess): SQL | undefined {
  return access.siteId ? eq(position.siteId, access.siteId) : undefined;
}

// Matches name case-insensitively. An empty query matches every position in the status.
function positionFilter(
  access: PositionAccess,
  query: string,
  status: PositionStatus,
  siteId: string | null,
): SQL | undefined {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    positionScopeFilter(access),
    siteId ? eq(position.siteId, siteId) : undefined,
    status === "active" ? isNull(position.deletedAt) : undefined,
    status === "deleted" ? isNotNull(position.deletedAt) : undefined,
    query ? ilike(position.name, pattern) : undefined,
  );
}

export async function listPositions(
  access: PositionAccess,
  { page, pageSize, query, status, siteId, sort }: PositionListParams,
): Promise<PositionPage> {
  const filter = positionFilter(access, query, status, siteId);
  const criteria = sort.length > 0 ? sort : DEFAULT_SORT;

  // Counted from the position table alone, so the site join does not inflate the total.
  const [{ total }] = await db.select({ total: count() }).from(position).where(filter);

  const currentPage = clampPage(page, total, pageSize);

  const rows = await db
    .select({
      id: position.id,
      name: position.name,
      siteId: position.siteId,
      siteName: site.name,
      deletedAt: position.deletedAt,
    })
    .from(position)
    .innerJoin(site, eq(site.id, position.siteId))
    .where(filter)
    .orderBy(...sortTerms(criteria, POSITION_SORT_EXPRESSIONS), asc(position.id))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return { rows, total, page: currentPage, pageSize };
}

// HO and admin site get their own site as fixed text. Superadmin picks from the active sites.
export async function positionSiteChoiceFor(access: PositionAccess): Promise<SiteChoice> {
  if (access.siteId) {
    const [own] = await db
      .select({ id: site.id, name: site.name })
      .from(site)
      .where(and(eq(site.id, access.siteId), isNull(site.deletedAt)));

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

// The row that canWriteToSite checks. A deleted site is not a valid target for a write.
export async function findSiteForWrite(siteId: string): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: site.id })
    .from(site)
    .where(and(eq(site.id, siteId), isNull(site.deletedAt)));

  return row;
}

// The site that holds a location. Admin site users reach positions through it.
export async function findLocationSiteId(locationId: string): Promise<string | null> {
  const [row] = await db
    .select({ siteId: location.siteId })
    .from(location)
    .where(eq(location.id, locationId));

  return row?.siteId ?? null;
}
