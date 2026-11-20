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
  location: location.name,
  status: sql`(${shift.deletedAt} is not null)`,
};

// HO sees every shift. Admin site sees the shifts of its own location. The filter reads shift.location_id
// only, so a select or an update on shift alone can carry it.
export function shiftScopeFilter(access: ShiftAccess): SQL | undefined {
  if (access.locationId) {
    return eq(shift.locationId, access.locationId);
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
  locationId: string | null,
): SQL | undefined {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    shiftScopeFilter(access),
    locationId ? eq(shift.locationId, locationId) : undefined,
    status === "active" ? isNull(shift.deletedAt) : undefined,
    status === "deleted" ? isNotNull(shift.deletedAt) : undefined,
    query ? ilike(shift.name, pattern) : undefined,
  );
}

export async function listShifts(
  access: ShiftAccess,
  { page, pageSize, query, status, locationId, sort }: ShiftListParams,
): Promise<ShiftPage> {
  const filter = shiftFilter(access, query, status, locationId);
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
      deletedAt: shift.deletedAt,
    })
    .from(shift)
    .innerJoin(location, eq(location.id, shift.locationId))
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

// Admin site gets its own location as fixed text. HO picks from every active location.
export async function shiftLocationChoiceFor(access: ShiftAccess): Promise<ShiftLocationChoice> {
  const option = { id: location.id, name: location.name };

  if (access.locationId) {
    const [own] = await db
      .select(option)
      .from(location)
      .where(and(eq(location.id, access.locationId), isNull(location.deletedAt)));

    if (!own) {
      notFound();
    }

    return { mode: "fixed", location: own };
  }

  const locations = await db
    .select(option)
    .from(location)
    .where(isNull(location.deletedAt))
    .orderBy(asc(location.name), asc(location.id));

  return { mode: "pick", locations };
}
