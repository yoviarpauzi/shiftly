import "server-only";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { attendance } from "@/database/schema/attendance-schema";
import { department, subDepartment } from "@/database/schema/department-schema";
import { position } from "@/database/schema/position-schema";
import { rosterRequest, rosterRequestLine } from "@/database/schema/request-schema";
import { roster, rosterAssignment } from "@/database/schema/roster-schema";
import { shift } from "@/database/schema/shift-schema";
import { worker } from "@/database/schema/worker-schema";
import { db } from "@/lib/db";
import type { WorkerHistoryRow } from "@/types/worker-history";
import type { WorkerAccess } from "@/types/workers";
import { coverRowsQuery } from "../attendance/attendance-cover";
import { sortHistory, toHistoryRows } from "./worker-history-rules";
import { workerScopeFilter } from "./workers";

// The assignments of one worker in the date range that count as history: a confirmed roster whose
// request is still approved, the same rule Attendance uses. A department, sub-department, or shift
// deleted afterwards stays: the day happened. The scope is applied here too, not only by the caller.
// A day worked as a replacement is added as a work row marked present, with the name of the absent
// worker, under the same scope applied to the replacement.
export async function loadWorkerMonth(
  access: WorkerAccess,
  workerId: string,
  bounds: { from: string; to: string },
): Promise<WorkerHistoryRow[]> {
  const joined = await db
    .select({
      assignmentId: rosterAssignment.id,
      date: rosterAssignment.workDate,
      kind: rosterAssignment.kind,
      shiftId: shift.id,
      shiftOrder: shift.order,
      shiftName: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      departmentId: department.id,
      departmentName: department.name,
      subDepartmentName: subDepartment.name,
      positionName: position.name,
      rosterId: roster.id,
      poNumber: rosterRequest.poNumber,
      attendanceStatus: attendance.status,
    })
    .from(rosterAssignment)
    .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .innerJoin(worker, eq(worker.id, rosterAssignment.workerId))
    .innerJoin(rosterRequestLine, eq(rosterRequestLine.id, rosterAssignment.requestLineId))
    .innerJoin(department, eq(department.id, rosterRequestLine.departmentId))
    .leftJoin(subDepartment, eq(subDepartment.id, rosterRequestLine.subDepartmentId))
    .innerJoin(position, eq(position.id, rosterRequestLine.positionId))
    .leftJoin(shift, eq(shift.id, rosterAssignment.shiftId))
    .leftJoin(attendance, eq(attendance.rosterAssignmentId, rosterAssignment.id))
    .where(
      and(
        eq(rosterAssignment.workerId, workerId),
        gte(rosterAssignment.workDate, bounds.from),
        lte(rosterAssignment.workDate, bounds.to),
        eq(roster.status, "confirmed"),
        eq(rosterRequest.status, "approved"),
        workerScopeFilter(access),
      ),
    )
    .orderBy(asc(rosterAssignment.workDate), asc(rosterAssignment.id));

  const covers = await coverRowsQuery(
    db,
    [workerId],
    bounds.from,
    bounds.to,
    workerScopeFilter(access),
  );

  const own = toHistoryRows(joined);

  if (covers.length === 0) {
    return own;
  }

  const covered = toHistoryRows(
    covers.map((cover) => ({
      assignmentId: cover.id,
      date: cover.date,
      kind: "work" as const,
      shiftId: cover.shiftId,
      shiftOrder: cover.shiftOrder,
      shiftName: cover.shiftName,
      startTime: cover.startTime,
      endTime: cover.endTime,
      departmentId: cover.departmentId,
      departmentName: cover.departmentName,
      subDepartmentName: cover.subDepartmentName,
      positionName: cover.positionName,
      rosterId: cover.rosterId,
      poNumber: cover.poNumber,
      attendanceStatus: "present",
      coveredFor: cover.absentWorkerName,
    })),
  );

  return sortHistory([...own, ...covered], "asc");
}

// Whether the worker has any history at all, in any month up to today, a day worked as a replacement included. It tells an empty month from
// a worker who was never in a confirmed roster. A roster that starts after today is not history
// yet, so a new hire does not get "pick an earlier month" for months that were never theirs.
export async function workerHasHistory(
  access: WorkerAccess,
  workerId: string,
  today: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: rosterAssignment.id })
    .from(rosterAssignment)
    .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .innerJoin(worker, eq(worker.id, rosterAssignment.workerId))
    .where(
      and(
        eq(rosterAssignment.workerId, workerId),
        lte(rosterAssignment.workDate, today),
        eq(roster.status, "confirmed"),
        eq(rosterRequest.status, "approved"),
        workerScopeFilter(access),
      ),
    )
    .limit(1);

  if (rows.length > 0) {
    return true;
  }

  const covers = await coverRowsQuery(db, [workerId], "0001-01-01", today, workerScopeFilter(access));

  return covers.length > 0;
}
