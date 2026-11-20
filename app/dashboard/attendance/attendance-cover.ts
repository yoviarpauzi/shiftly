import "server-only";
import { and, asc, count, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { attendance, attendanceSubstitute } from "@/database/schema/attendance-schema";
import { department, subDepartment } from "@/database/schema/department-schema";
import { position } from "@/database/schema/position-schema";
import { rosterRequest, rosterRequestLine } from "@/database/schema/request-schema";
import { roster, rosterAssignment } from "@/database/schema/roster-schema";
import { shift } from "@/database/schema/shift-schema";
import { worker } from "@/database/schema/worker-schema";
import { db } from "@/lib/db";
import type { Reader } from "@/types/rosters";

// The days the given workers worked as a replacement, between from and to (YYYY-MM-DD, inclusive).
// One row per replacement. This is the single reader of a replacement's day: every screen or report
// that counts or lists covered days goes through it, so they all agree on what is live.
//
// A replacement is live only through the absent worker's own assignment: a work assignment of a
// confirmed roster whose request is approved, with its attendance row still Absent. A draft roster,
// a cancelled request or a cleared mark leaves no row here. The query does not scope by location.
// Pass scope, a condition on the replacement's `worker` row such as workerScopeFilter, to narrow it.
// With no workerIds nothing is queried.
export async function coverRowsQuery(
  reader: Reader,
  workerIds: string[],
  from: string,
  to: string,
  scope?: SQL,
) {
  if (workerIds.length === 0) {
    return [];
  }

  const absentWorker = alias(worker, "absent_worker");

  return reader
    .select({
      id: attendanceSubstitute.id,
      workerId: attendanceSubstitute.substituteWorkerId,
      date: attendanceSubstitute.workDate,
      shiftId: shift.id,
      shiftOrder: shift.order,
      shiftName: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      departmentId: department.id,
      departmentName: department.name,
      subDepartmentId: rosterRequestLine.subDepartmentId,
      subDepartmentName: subDepartment.name,
      positionName: position.name,
      rosterId: roster.id,
      poNumber: rosterRequest.poNumber,
      absentWorkerName: absentWorker.name,
    })
    .from(attendanceSubstitute)
    .innerJoin(worker, eq(worker.id, attendanceSubstitute.substituteWorkerId))
    .innerJoin(attendance, eq(attendance.id, attendanceSubstitute.attendanceId))
    .innerJoin(rosterAssignment, eq(rosterAssignment.id, attendance.rosterAssignmentId))
    .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .innerJoin(rosterRequestLine, eq(rosterRequestLine.id, rosterAssignment.requestLineId))
    .innerJoin(department, eq(department.id, rosterRequestLine.departmentId))
    .leftJoin(subDepartment, eq(subDepartment.id, rosterRequestLine.subDepartmentId))
    .innerJoin(position, eq(position.id, rosterRequestLine.positionId))
    .innerJoin(shift, eq(shift.id, rosterAssignment.shiftId))
    .innerJoin(absentWorker, eq(absentWorker.id, rosterAssignment.workerId))
    .where(
      and(
        inArray(attendanceSubstitute.substituteWorkerId, workerIds),
        gte(attendanceSubstitute.workDate, from),
        lte(attendanceSubstitute.workDate, to),
        eq(attendance.status, "absent"),
        eq(rosterAssignment.kind, "work"),
        eq(roster.status, "confirmed"),
        eq(rosterRequest.status, "approved"),
        scope,
      ),
    )
    .orderBy(asc(attendanceSubstitute.workDate), asc(attendanceSubstitute.id));
}

// How many replacements cover a shift on each date, for the shifts of the given locations, between
// from and to (YYYY-MM-DD, inclusive). One row per date with at least one. The dashboard adds it
// to the day's Present. It applies the same live rule as coverRowsQuery: the absent worker's work
// assignment on a confirmed roster of an approved request, with its attendance row still Absent.
// The date and the location are those of the absent worker's assignment, the shift that was covered.
// With no locationIds nothing is queried.
export async function coverCountsByDate(
  locationIds: string[],
  from: string,
  to: string,
): Promise<{ workDate: string; covered: number }[]> {
  if (locationIds.length === 0) {
    return [];
  }

  return db
    .select({ workDate: rosterAssignment.workDate, covered: count() })
    .from(attendanceSubstitute)
    .innerJoin(attendance, eq(attendance.id, attendanceSubstitute.attendanceId))
    .innerJoin(rosterAssignment, eq(rosterAssignment.id, attendance.rosterAssignmentId))
    .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .where(
      and(
        eq(attendance.status, "absent"),
        eq(rosterAssignment.kind, "work"),
        eq(roster.status, "confirmed"),
        eq(rosterRequest.status, "approved"),
        inArray(rosterRequest.locationId, locationIds),
        gte(rosterAssignment.workDate, from),
        lte(rosterAssignment.workDate, to),
      ),
    )
    .groupBy(rosterAssignment.workDate);
}
