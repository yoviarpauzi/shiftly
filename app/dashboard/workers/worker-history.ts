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
import { toHistoryRows } from "./worker-history-rules";
import { workerScopeFilter } from "./workers";

// The assignments of one worker in the date range that count as history: a confirmed roster whose
// request is still approved, the same rule Attendance uses. A department, sub-department, or shift
// deleted afterwards stays: the day happened. The scope is applied here too, not only by the caller.
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

  return toHistoryRows(joined);
}

// Whether the worker has any history at all, in any month. It tells an empty month from a worker
// who was never in a confirmed roster.
export async function workerHasHistory(access: WorkerAccess, workerId: string): Promise<boolean> {
  const rows = await db
    .select({ id: rosterAssignment.id })
    .from(rosterAssignment)
    .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .innerJoin(worker, eq(worker.id, rosterAssignment.workerId))
    .where(
      and(
        eq(rosterAssignment.workerId, workerId),
        eq(roster.status, "confirmed"),
        eq(rosterRequest.status, "approved"),
        workerScopeFilter(access),
      ),
    )
    .limit(1);

  return rows.length > 0;
}
