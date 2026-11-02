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
import { shift } from "@/database/schema/shift-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import { clampPage, escapeLikePattern } from "@/lib/pagination";
import { sortTerms } from "@/lib/sort";
import type { SiteChoice } from "@/types/locations";
import type {
  ShiftAccess,
  ShiftListParams,
  ShiftPage,
  ShiftSortColumn,
  ShiftStatus,
} from "@/types/shifts";
import type { SortCriterion } from "@/types/sort";
import { toHourMinute } from "./shift-rules";

const DEFAULT_SORT: SortCriterion<ShiftSortColumn>[] = [
  { column: "site", direction: "asc" },
  { column: "order", direction: "asc" },
];

// Each sortable column maps to a fixed expression. URL input only picks a key from this map.
const SHIFT_SORT_EXPRESSIONS: Record<ShiftSortColumn, SQLWrapper> = {
  order: shift.order,
  name: shift.name,
  site: site.name,
  status: sql`(${shift.deletedAt} is not null)`,
};

// Superadmin sees every shift. HO and admin site see the shifts of their own site.
export function shiftScopeFilter(access: ShiftAccess): SQL | undefined {
  return access.siteId ? eq(shift.siteId, access.siteId) : undefined;
}

// Matches name case-insensitively. An empty query matches every shift in the status.
function shiftFilter(
  access: ShiftAccess,
  query: string,
  status: ShiftStatus,
  siteId: string | null,
): SQL | undefined {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    shiftScopeFilter(access),
    siteId ? eq(shift.siteId, siteId) : undefined,
    status === "active" ? isNull(shift.deletedAt) : undefined,
    status === "deleted" ? isNotNull(shift.deletedAt) : undefined,
    query ? ilike(shift.name, pattern) : undefined,
  );
}

export async function listShifts(
  access: ShiftAccess,
  { page, pageSize, query, status, siteId, sort }: ShiftListParams,
): Promise<ShiftPage> {
  const filter = shiftFilter(access, query, status, siteId);
  const criteria = sort.length > 0 ? sort : DEFAULT_SORT;

  // Counted from the shift table alone, so the site join does not inflate the total.
  const [{ total }] = await db.select({ total: count() }).from(shift).where(filter);

  const currentPage = clampPage(page, total, pageSize);

  const rows = await db
    .select({
      id: shift.id,
      order: shift.order,
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      siteId: shift.siteId,
      siteName: site.name,
      deletedAt: shift.deletedAt,
    })
    .from(shift)
    .innerJoin(site, eq(site.id, shift.siteId))
    .where(filter)
    .orderBy(...sortTerms(criteria, SHIFT_SORT_EXPRESSIONS), asc(shift.id))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return {
    rows: rows.map((row) => ({
      ...row,
      startTime: toHourMinute(row.startTime),
      endTime: toHourMinute(row.endTime),
    })),
    total,
    page: currentPage,
    pageSize,
  };
}

// HO and admin site get their own site as fixed text. Superadmin picks from the active sites.
export async function shiftSiteChoiceFor(access: ShiftAccess): Promise<SiteChoice> {
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

// The site that holds a location. Admin site users reach shifts through it.
export async function findLocationSiteId(locationId: string): Promise<string | null> {
  const [row] = await db
    .select({ siteId: location.siteId })
    .from(location)
    .where(eq(location.id, locationId));

  return row?.siteId ?? null;
}
