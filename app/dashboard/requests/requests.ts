import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  type SQL,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import { department, subDepartment } from "@/database/schema/department-schema";
import { user } from "@/database/schema/auth-schema";
import { location } from "@/database/schema/location-schema";
import { position } from "@/database/schema/position-schema";
import { shift } from "@/database/schema/shift-schema";
import {
  rosterRequest,
  rosterRequestLine,
  rosterRequestLineDay,
} from "@/database/schema/request-schema";
import { db } from "@/lib/db";
import { clampPage, escapeLikePattern } from "@/lib/pagination";
import { sortTerms } from "@/lib/sort";
import type {
  RequestAccess,
  RequestChoices,
  RequestDetail,
  RequestListParams,
  RequestPage,
  RequestSortColumn,
  RequestStatus,
  RequestType,
} from "@/types/requests";
import type { SortCriterion } from "@/types/sort";
import { toHourMinute } from "../shifts/shift-rules";

const DEFAULT_SORT: SortCriterion<RequestSortColumn>[] = [
  { column: "date", direction: "desc" },
  { column: "po", direction: "desc" },
];

// Each sortable column maps to a fixed expression. URL input only picks a key from this map.
const REQUEST_SORT_EXPRESSIONS: Record<RequestSortColumn, SQLWrapper> = {
  po: rosterRequest.poNumber,
  type: rosterRequest.type,
  date: rosterRequest.startDate,
  location: location.name,
  status: rosterRequest.status,
};

// HO sees every request. Admin site sees the requests of its own location.
export function requestScopeFilter(access: RequestAccess): SQL | undefined {
  return access.locationId ? eq(rosterRequest.locationId, access.locationId) : undefined;
}

// Matches the PO number case-insensitively. An empty query matches every request in the filters.
function requestFilter(
  access: RequestAccess,
  { query, status, type, locationId }: RequestListParams,
): SQL | undefined {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    requestScopeFilter(access),
    locationId ? eq(rosterRequest.locationId, locationId) : undefined,
    status !== "all" ? eq(rosterRequest.status, status) : undefined,
    type !== "all" ? eq(rosterRequest.type, type) : undefined,
    query ? ilike(rosterRequest.poNumber, pattern) : undefined,
  );
}

export async function listRequests(
  access: RequestAccess,
  params: RequestListParams,
): Promise<RequestPage> {
  const { page, pageSize, sort } = params;
  const filter = requestFilter(access, params);
  const criteria = sort.length > 0 ? sort : DEFAULT_SORT;

  // Counted from the request table alone, so the joins do not inflate the total.
  const [{ total }] = await db
    .select({ total: count() })
    .from(rosterRequest)
    .where(filter);

  const currentPage = clampPage(page, total, pageSize);

  const lineCounts = db
    .select({
      requestId: rosterRequestLine.requestId,
      lineCount: count().as("line_count"),
    })
    .from(rosterRequestLine)
    .groupBy(rosterRequestLine.requestId)
    .as("line_counts");

  const rows = await db
    .select({
      id: rosterRequest.id,
      poNumber: rosterRequest.poNumber,
      type: rosterRequest.type,
      startDate: rosterRequest.startDate,
      status: rosterRequest.status,
      locationId: rosterRequest.locationId,
      locationName: location.name,
      lineCount: sql<number>`coalesce(${lineCounts.lineCount}, 0)`.mapWith(Number),
      createdByName: user.name,
    })
    .from(rosterRequest)
    .innerJoin(location, eq(location.id, rosterRequest.locationId))
    .innerJoin(user, eq(user.id, rosterRequest.createdBy))
    .leftJoin(lineCounts, eq(lineCounts.requestId, rosterRequest.id))
    .where(filter)
    .orderBy(
      ...sortTerms(criteria, REQUEST_SORT_EXPRESSIONS),
      criteria[criteria.length - 1].direction === "desc"
        ? desc(rosterRequest.id)
        : asc(rosterRequest.id),
    )
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return {
    rows: rows.map((row) => ({
      ...row,
      type: row.type as RequestType,
      status: row.status as RequestStatus,
    })),
    total,
    page: currentPage,
    pageSize,
  };
}

// An id outside the actor's scope returns null, the same as a missing one.
export async function getRequest(
  access: RequestAccess,
  id: string,
): Promise<RequestDetail | null> {
  const [row] = await db
    .select({
      id: rosterRequest.id,
      poNumber: rosterRequest.poNumber,
      type: rosterRequest.type,
      startDate: rosterRequest.startDate,
      status: rosterRequest.status,
      locationId: rosterRequest.locationId,
      locationName: location.name,
      createdByName: user.name,
      rejectReason: rosterRequest.rejectReason,
    })
    .from(rosterRequest)
    .innerJoin(location, eq(location.id, rosterRequest.locationId))
    .innerJoin(user, eq(user.id, rosterRequest.createdBy))
    .where(and(eq(rosterRequest.id, id), requestScopeFilter(access)));

  if (!row) {
    return null;
  }

  const lineRows = await db
    .select({
      id: rosterRequestLine.id,
      departmentId: rosterRequestLine.departmentId,
      subDepartmentId: rosterRequestLine.subDepartmentId,
      positionId: rosterRequestLine.positionId,
      shiftId: rosterRequestLine.shiftId,
    })
    .from(rosterRequestLine)
    .where(eq(rosterRequestLine.requestId, id))
    .orderBy(asc(rosterRequestLine.id));

  // Ordered by line and then day offset, so each line's numbers come back in day order whatever
  // order they were inserted in.
  const dayRows = await db
    .select({ lineId: rosterRequestLineDay.lineId, headcount: rosterRequestLineDay.headcount })
    .from(rosterRequestLineDay)
    .innerJoin(rosterRequestLine, eq(rosterRequestLine.id, rosterRequestLineDay.lineId))
    .where(eq(rosterRequestLine.requestId, id))
    .orderBy(asc(rosterRequestLineDay.lineId), asc(rosterRequestLineDay.dayOffset));

  const shiftIds = [...new Set(lineRows.flatMap((line) => (line.shiftId ? [line.shiftId] : [])))];

  // No deletedAt filter: the detail keeps showing the shift a line asked for after it is deleted.
  const lineShifts =
    shiftIds.length === 0
      ? []
      : await db
          .select({
            id: shift.id,
            name: shift.name,
            order: shift.order,
            startTime: shift.startTime,
            endTime: shift.endTime,
            locationId: shift.locationId,
          })
          .from(shift)
          .where(inArray(shift.id, shiftIds))
          .orderBy(asc(shift.order));

  const headcountsByLine = new Map<string, number[]>();

  for (const day of dayRows) {
    const headcounts = headcountsByLine.get(day.lineId) ?? [];

    headcounts.push(day.headcount);
    headcountsByLine.set(day.lineId, headcounts);
  }

  const lines = lineRows.map(({ id: lineId, ...line }) => ({
    ...line,
    headcounts: headcountsByLine.get(lineId) ?? [],
  }));

  return {
    ...row,
    type: row.type as RequestType,
    status: row.status as RequestStatus,
    lineCount: lines.length,
    lines,
    lineShifts: lineShifts.map((row) => ({
      ...row,
      startTime: toHourMinute(row.startTime),
      endTime: toHourMinute(row.endTime),
    })),
  };
}

// The active locations the actor can write to, their active departments and sub-departments, the
// active positions (global master data) and the active shifts of those locations.
export async function requestChoicesFor(access: RequestAccess): Promise<RequestChoices> {
  const locations = await db
    .select({
      id: location.id,
      name: location.name,
      timezone: location.timezone,
    })
    .from(location)
    .where(
      and(
        isNull(location.deletedAt),
        access.locationId ? eq(location.id, access.locationId) : undefined,
      ),
    )
    .orderBy(asc(location.name), asc(location.id));

  if (locations.length === 0) {
    return { locations, departments: [], subDepartments: [], positions: [], shifts: [] };
  }

  const locationIds = locations.map((row) => row.id);
  const departments = await db
    .select({
      id: department.id,
      name: department.name,
      locationId: department.locationId,
    })
    .from(department)
    .where(and(inArray(department.locationId, locationIds), isNull(department.deletedAt)))
    .orderBy(asc(department.name), asc(department.id));

  const departmentIds = departments.map((row) => row.id);

  const subDepartments =
    departmentIds.length === 0
      ? []
      : await db
          .select({
            id: subDepartment.id,
            name: subDepartment.name,
            departmentId: subDepartment.departmentId,
          })
          .from(subDepartment)
          .where(
            and(
              inArray(subDepartment.departmentId, departmentIds),
              isNull(subDepartment.deletedAt),
            ),
          )
          .orderBy(asc(subDepartment.name), asc(subDepartment.id));

  const positions = await db
    .select({ id: position.id, name: position.name })
    .from(position)
    .where(isNull(position.deletedAt))
    .orderBy(asc(position.name), asc(position.id));

  const shifts = await db
    .select({
      id: shift.id,
      name: shift.name,
      order: shift.order,
      startTime: shift.startTime,
      endTime: shift.endTime,
      locationId: shift.locationId,
    })
    .from(shift)
    .where(and(inArray(shift.locationId, locationIds), isNull(shift.deletedAt)))
    .orderBy(asc(shift.locationId), asc(shift.order));

  return {
    locations,
    departments,
    subDepartments,
    positions,
    shifts: shifts.map((row) => ({
      ...row,
      startTime: toHourMinute(row.startTime),
      endTime: toHourMinute(row.endTime),
    })),
  };
}
