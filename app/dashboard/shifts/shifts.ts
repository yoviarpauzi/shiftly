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
import { rosterRequest, rosterRequestLine } from "@/database/schema/request-schema";
import { shift } from "@/database/schema/shift-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import { clampPage, escapeLikePattern } from "@/lib/pagination";
import { sortTerms } from "@/lib/sort";
import type { Reader } from "@/types/rosters";
import type {
  ShiftAccess,
  ShiftListParams,
  ShiftLocationChoice,
  ShiftPage,
  ShiftSortColumn,
  ShiftStatus,
} from "@/types/shifts";
import type { SortCriterion } from "@/types/sort";
import { toHourMinute } from "./shift-rules";

const DEFAULT_SORT: SortCriterion<ShiftSortColumn>[] = [
  { column: "location", direction: "asc" },
  { column: "order", direction: "asc" },
];

// Each sortable column maps to a fixed expression. URL input only picks a key from this map.
const SHIFT_SORT_EXPRESSIONS: Record<ShiftSortColumn, SQLWrapper> = {
  order: shift.order,
  name: shift.name,
  location: sql`concat(${site.name}, ' / ', ${location.name})`,
  status: sql`(${shift.deletedAt} is not null)`,
};

// Shifts of the locations of one site, as a subquery so a select or an update on shift alone can carry it.
function shiftSiteFilter(siteId: string): SQL {
  return sql`${shift.locationId} in (select ${location.id} from ${location} where ${location.siteId} = ${siteId})`;
}

// Superadmin sees every shift. HO sees the shifts of the locations of its site. Admin site sees the
// shifts of its own location. The site case is a subquery rather than a join, so a select or an
// update on shift alone can carry the filter.
export function shiftScopeFilter(access: ShiftAccess): SQL | undefined {
  if (access.locationId) {
    return eq(shift.locationId, access.locationId);
  }

  if (access.siteId) {
    return shiftSiteFilter(access.siteId);
  }

  return undefined;
}

// The statuses of the requests whose lines use the shift, one entry per status.
export async function shiftRequestStatuses(reader: Reader, shiftId: string): Promise<string[]> {
  const rows = await reader
    .select({ status: rosterRequest.status })
    .from(rosterRequestLine)
    .innerJoin(rosterRequest, eq(rosterRequest.id, rosterRequestLine.requestId))
    .where(eq(rosterRequestLine.shiftId, shiftId))
    .groupBy(rosterRequest.status);

  return rows.map((row) => row.status);
}

// Matches name case-insensitively. An empty query matches every shift in the status.
function shiftFilter(
  access: ShiftAccess,
  query: string,
  status: ShiftStatus,
  siteId: string | null,
  locationId: string | null,
): SQL | undefined {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    shiftScopeFilter(access),
    siteId ? shiftSiteFilter(siteId) : undefined,
    locationId ? eq(shift.locationId, locationId) : undefined,
    status === "active" ? isNull(shift.deletedAt) : undefined,
    status === "deleted" ? isNotNull(shift.deletedAt) : undefined,
    query ? ilike(shift.name, pattern) : undefined,
  );
}

export async function listShifts(
  access: ShiftAccess,
  { page, pageSize, query, status, siteId, locationId, sort }: ShiftListParams,
): Promise<ShiftPage> {
  const filter = shiftFilter(access, query, status, siteId, locationId);
  const criteria = sort.length > 0 ? sort : DEFAULT_SORT;

  // Counted from the shift table alone, so the joins do not inflate the total.
  const [{ total }] = await db.select({ total: count() }).from(shift).where(filter);

  const currentPage = clampPage(page, total, pageSize);

  const rows = await db
    .select({
      id: shift.id,
      order: shift.order,
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      locationId: shift.locationId,
      locationName: location.name,
      siteName: site.name,
      deletedAt: shift.deletedAt,
    })
    .from(shift)
    .innerJoin(location, eq(location.id, shift.locationId))
    .innerJoin(site, eq(site.id, location.siteId))
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

// Admin site gets its own location as fixed text. Superadmin and HO pick from the active locations
// in scope, which for HO are the locations of its site.
export async function shiftLocationChoiceFor(access: ShiftAccess): Promise<ShiftLocationChoice> {
  const option = {
    id: location.id,
    name: location.name,
    siteId: site.id,
    siteName: site.name,
  };

  if (access.locationId) {
    const [own] = await db
      .select(option)
      .from(location)
      .innerJoin(site, eq(site.id, location.siteId))
      .where(and(eq(location.id, access.locationId), isNull(location.deletedAt)));

    if (!own) {
      notFound();
    }

    return { mode: "fixed", location: own };
  }

  const locations = await db
    .select(option)
    .from(location)
    .innerJoin(site, eq(site.id, location.siteId))
    .where(
      and(isNull(location.deletedAt), access.siteId ? eq(location.siteId, access.siteId) : undefined),
    )
    .orderBy(asc(site.name), asc(location.name), asc(location.id));

  return { mode: "pick", locations };
}
