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
import { site } from "@/database/schema/site-schema";
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

// Superadmin sees every request. HO sees the requests of its own site. Admin site sees its own location.
export function requestScopeFilter(access: RequestAccess): SQL | undefined {
  if (access.locationId) {
    return eq(rosterRequest.locationId, access.locationId);
  }

  return access.siteId ? eq(rosterRequest.siteId, access.siteId) : undefined;
}

// Matches the PO number case-insensitively. An empty query matches every request in the filters.
function requestFilter(
  access: RequestAccess,
  { query, status, type, siteId, locationId }: RequestListParams,
): SQL | undefined {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    requestScopeFilter(access),
    siteId ? eq(rosterRequest.siteId, siteId) : undefined,
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
      siteId: rosterRequest.siteId,
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
      siteId: rosterRequest.siteId,
      siteName: site.name,
      locationId: rosterRequest.locationId,
      locationName: location.name,
      createdByName: user.name,
      rejectReason: rosterRequest.rejectReason,
    })
    .from(rosterRequest)
    .innerJoin(site, eq(site.id, rosterRequest.siteId))
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
  };
}

// The active locations the actor can write to, the active sites that hold them, their active
// departments and sub-departments, and the active positions of those sites.
export async function requestChoicesFor(access: RequestAccess): Promise<RequestChoices> {
  const locations = await db
    .select({
      id: location.id,
      name: location.name,
      siteId: location.siteId,
      timezone: location.timezone,
    })
    .from(location)
    .where(
      and(
        isNull(location.deletedAt),
        access.siteId ? eq(location.siteId, access.siteId) : undefined,
        access.locationId ? eq(location.id, access.locationId) : undefined,
      ),
    )
    .orderBy(asc(location.name), asc(location.id));

  if (locations.length === 0) {
    return { sites: [], locations, departments: [], subDepartments: [], positions: [], shifts: [] };
  }

  const locationIds = locations.map((row) => row.id);
  const siteIds = [...new Set(locations.map((row) => row.siteId))];

  const sites = await db
    .select({ id: site.id, name: site.name })
    .from(site)
    .where(and(inArray(site.id, siteIds), isNull(site.deletedAt)))
    .orderBy(asc(site.name), asc(site.id));

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
    .select({ id: position.id, name: position.name, siteId: position.siteId })
    .from(position)
    .where(and(inArray(position.siteId, siteIds), isNull(position.deletedAt)))
    .orderBy(asc(position.name), asc(position.id));

  const shifts = await db
    .select({
      id: shift.id,
      name: shift.name,
      order: shift.order,
      startTime: shift.startTime,
      endTime: shift.endTime,
      siteId: shift.siteId,
    })
    .from(shift)
    .where(and(inArray(shift.siteId, siteIds), isNull(shift.deletedAt)))
    .orderBy(asc(shift.siteId), asc(shift.order));

  return {
    sites,
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
