import "server-only";
import { and, asc, between, count, desc, eq, exists, inArray, notExists, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { attendance } from "@/database/schema/attendance-schema";
import { user } from "@/database/schema/auth-schema";
import { billing, billingAttendance, billingLine } from "@/database/schema/billing-schema";
import { department, subDepartment } from "@/database/schema/department-schema";
import { location } from "@/database/schema/location-schema";
import { position } from "@/database/schema/position-schema";
import { rosterRequest, rosterRequestLine } from "@/database/schema/request-schema";
import { roster, rosterAssignment } from "@/database/schema/roster-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import { clampPage } from "@/lib/pagination";
import type {
  BillableDay,
  BillingAccess,
  BillingDetail,
  BillingGroups,
  BillingListParams,
  BillingPage,
  BillingPeriod,
} from "@/types/billings";
import type { Transaction } from "@/types/requests";
import { parseBillingId } from "@/validation/billings";
import { groupBillableDays } from "./billing-rules";

export const ATTENDANCE_PRESENT = "present";
export const ASSIGNMENT_WORK = "work";
export const ROSTER_CONFIRMED = "confirmed";

// A billing follows confirmed rosters whatever the request status is now, and a day that happened
// stays billable after a worker, department or position is deleted. So there is no request status
// filter and no deleted_at filter here.
function dayConditions(locationId: string, period: BillingPeriod): SQL | undefined {
  return and(
    eq(rosterRequest.locationId, locationId),
    between(rosterAssignment.workDate, period.from, period.to),
    eq(attendance.status, ATTENDANCE_PRESENT),
    eq(rosterAssignment.kind, ASSIGNMENT_WORK),
    eq(roster.status, ROSTER_CONFIRMED),
  );
}

// A raw subquery, because a Drizzle subquery on one table leaves the outer attendance column unqualified.
const claimedDay = sql`(select 1 from ${billingAttendance} where ${billingAttendance.attendanceId} = ${attendance.id})`;

// The days of a location and period that no billing holds yet.
export function billableDayConditions(locationId: string, period: BillingPeriod): SQL {
  return and(dayConditions(locationId, period), notExists(claimedDay)) as SQL;
}

// Superadmin sees every billing. HO sees the billings of its own site. Admin site sees its own location.
export function billingScopeFilter(access: BillingAccess): SQL | undefined {
  if (access.locationId) {
    return eq(billing.locationId, access.locationId);
  }

  return access.siteId ? eq(billing.siteId, access.siteId) : undefined;
}

// With `lock`, the attendance rows are locked for update in id order, which is how issuing and
// the Attendance save both take them, so two transactions cannot wait on each other.
export async function loadBillableDays(
  client: typeof db | Transaction,
  locationId: string,
  period: BillingPeriod,
  options?: { lock?: boolean },
): Promise<BillableDay[]> {
  const query = client
    .select({
      attendanceId: attendance.id,
      requestId: rosterRequest.id,
      poNumber: rosterRequest.poNumber,
      departmentId: department.id,
      departmentName: department.name,
      subDepartmentId: subDepartment.id,
      subDepartmentName: subDepartment.name,
      positionId: position.id,
      positionName: position.name,
    })
    .from(attendance)
    .innerJoin(rosterAssignment, eq(rosterAssignment.id, attendance.rosterAssignmentId))
    .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .innerJoin(rosterRequestLine, eq(rosterRequestLine.id, rosterAssignment.requestLineId))
    .innerJoin(department, eq(department.id, rosterRequestLine.departmentId))
    .leftJoin(subDepartment, eq(subDepartment.id, rosterRequestLine.subDepartmentId))
    .innerJoin(position, eq(position.id, rosterRequestLine.positionId))
    .where(billableDayConditions(locationId, period))
    .orderBy(asc(attendance.id));

  return options?.lock ? await query.for("update", { of: attendance }) : await query;
}

// The present days of the period that some billing already holds: what a Draft leaves out.
export async function countClaimedDays(locationId: string, period: BillingPeriod): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(attendance)
    .innerJoin(rosterAssignment, eq(rosterAssignment.id, attendance.rosterAssignmentId))
    .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .where(and(dayConditions(locationId, period), exists(claimedDay)));

  return total;
}

function billingFilter(
  access: BillingAccess,
  { status, siteId, locationId }: BillingListParams,
): SQL | undefined {
  return and(
    billingScopeFilter(access),
    status !== "all" ? eq(billing.status, status) : undefined,
    siteId ? eq(billing.siteId, siteId) : undefined,
    locationId ? eq(billing.locationId, locationId) : undefined,
  );
}

export async function listBillings(
  access: BillingAccess,
  params: BillingListParams,
): Promise<BillingPage> {
  const { page, pageSize } = params;
  const filter = billingFilter(access, params);

  const [{ total }] = await db.select({ total: count() }).from(billing).where(filter);

  const currentPage = clampPage(page, total, pageSize);

  const rows = await db
    .select({
      id: billing.id,
      number: billing.number,
      locationId: billing.locationId,
      locationName: location.name,
      siteName: site.name,
      mode: billing.mode,
      periodStart: billing.periodStart,
      periodEnd: billing.periodEnd,
      status: billing.status,
      issuedAt: billing.issuedAt,
    })
    .from(billing)
    .innerJoin(location, eq(location.id, billing.locationId))
    .innerJoin(site, eq(site.id, billing.siteId))
    .where(filter)
    .orderBy(desc(billing.createdAt), desc(billing.id))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  const lineTotals = new Map<string, number>();
  const ids = rows.filter((row) => row.status !== "draft").map((row) => row.id);

  if (ids.length > 0) {
    const sums = await db
      .select({
        billingId: billingLine.billingId,
        days: sql<number>`sum(${billingLine.days})`.mapWith(Number),
      })
      .from(billingLine)
      .where(inArray(billingLine.billingId, ids))
      .groupBy(billingLine.billingId);

    for (const sum of sums) {
      lineTotals.set(sum.billingId, sum.days);
    }
  }

  return {
    rows: rows.map((row) => ({
      ...row,
      issuedAt: row.issuedAt?.toISOString() ?? null,
      totalDays: row.status === "draft" ? null : (lineTotals.get(row.id) ?? 0),
    })),
    total,
    page: currentPage,
    pageSize,
  };
}

// A Draft is computed live. An Issued or Void billing reads the snapshot written at Issue.
async function issuedGroups(billingId: string): Promise<BillingGroups> {
  const lines = await db
    .select({
      requestId: billingLine.requestId,
      poNumber: billingLine.poNumber,
      departmentId: billingLine.departmentId,
      departmentName: billingLine.departmentName,
      subDepartmentId: billingLine.subDepartmentId,
      subDepartmentName: billingLine.subDepartmentName,
      positionId: billingLine.positionId,
      positionName: billingLine.positionName,
      days: billingLine.days,
    })
    .from(billingLine)
    .where(eq(billingLine.billingId, billingId));

  // Each line expands to its days, so the grouping and its ordering stay in one place.
  return groupBillableDays(
    lines.flatMap(({ days, ...line }) => Array.from({ length: days }, () => line)),
  );
}

// An id that is malformed, missing or outside the actor's scope returns null. The location is not
// filtered by deleted_at: a billing keeps its location after it is deleted.
export async function getBilling(access: BillingAccess, id: string): Promise<BillingDetail | null> {
  if (!parseBillingId(id)) {
    return null;
  }

  const createdBy = alias(user, "created_by_user");
  const issuedBy = alias(user, "issued_by_user");
  const voidedBy = alias(user, "voided_by_user");

  const [row] = await db
    .select({
      id: billing.id,
      number: billing.number,
      status: billing.status,
      mode: billing.mode,
      periodStart: billing.periodStart,
      periodEnd: billing.periodEnd,
      siteId: billing.siteId,
      locationId: billing.locationId,
      locationName: location.name,
      siteName: site.name,
      updatedAt: billing.updatedAt,
      createdByName: createdBy.name,
      issuedByName: issuedBy.name,
      issuedAt: billing.issuedAt,
      voidedByName: voidedBy.name,
      voidedAt: billing.voidedAt,
      voidReason: billing.voidReason,
    })
    .from(billing)
    .innerJoin(location, eq(location.id, billing.locationId))
    .innerJoin(site, eq(site.id, billing.siteId))
    .leftJoin(createdBy, eq(createdBy.id, billing.createdBy))
    .leftJoin(issuedBy, eq(issuedBy.id, billing.issuedBy))
    .leftJoin(voidedBy, eq(voidedBy.id, billing.voidedBy))
    .where(and(eq(billing.id, id), billingScopeFilter(access)));

  if (!row) {
    return null;
  }

  const { updatedAt, ...rest } = row;
  const period = { from: row.periodStart, to: row.periodEnd };
  const isDraft = row.status === "draft";

  const groups = isDraft
    ? groupBillableDays(await loadBillableDays(db, row.locationId, period))
    : await issuedGroups(row.id);

  return {
    ...rest,
    version: updatedAt.toISOString(),
    issuedAt: row.issuedAt?.toISOString() ?? null,
    voidedAt: row.voidedAt?.toISOString() ?? null,
    groups,
    excludedDays: isDraft ? await countClaimedDays(row.locationId, period) : null,
  };
}
