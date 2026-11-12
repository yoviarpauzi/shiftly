import "server-only";
import { and, asc, between, eq, gt, isNull } from "drizzle-orm";
import { department } from "@/database/schema/department-schema";
import { location } from "@/database/schema/location-schema";
import { position } from "@/database/schema/position-schema";
import { rosterRequest, rosterRequestLine } from "@/database/schema/request-schema";
import { roster, rosterAssignment, rosterShiftTarget } from "@/database/schema/roster-schema";
import { shift } from "@/database/schema/shift-schema";
import { worker } from "@/database/schema/worker-schema";
import { db } from "@/lib/db";
import type { AttendanceAccess } from "@/types/attendance";
import type { ExportInput } from "@/types/attendance-export";
import { canAccessAttendanceLocation } from "./attendance-access";

// What the export reads for one location and one week: its work rows, and the shift split of each
// request line. Both come from confirmed rosters whose request is still approved, the rule the
// Attendance page uses. A worker, department, or shift deleted afterwards stays: the day happened.
// Null when the location does not exist or the access does not cover it, and then nothing else is
// read.
export async function loadExportInput(
  access: AttendanceAccess,
  locationId: string,
  from: string,
  to: string,
): Promise<ExportInput | null> {
  const [place] = await db
    .select({ id: location.id, name: location.name, siteId: location.siteId })
    .from(location)
    .where(and(eq(location.id, locationId), isNull(location.deletedAt)));

  if (!place || !canAccessAttendanceLocation(access, place)) {
    return null;
  }

  const activeShifts = await db
    .select({ id: shift.id, order: shift.order })
    .from(shift)
    .where(and(eq(shift.locationId, locationId), isNull(shift.deletedAt)))
    .orderBy(asc(shift.order), asc(shift.id));

  const assignments = await db
    .select({
      employeeId: worker.employeeId,
      workerName: worker.name,
      departmentId: department.id,
      departmentName: department.name,
      positionId: position.id,
      positionName: position.name,
      date: rosterAssignment.workDate,
      shiftId: shift.id,
      shiftOrder: shift.order,
    })
    .from(rosterAssignment)
    .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .innerJoin(worker, eq(worker.id, rosterAssignment.workerId))
    .innerJoin(rosterRequestLine, eq(rosterRequestLine.id, rosterAssignment.requestLineId))
    .innerJoin(department, eq(department.id, rosterRequestLine.departmentId))
    .innerJoin(position, eq(position.id, rosterRequestLine.positionId))
    .innerJoin(shift, eq(shift.id, rosterAssignment.shiftId))
    .where(
      and(
        eq(rosterRequest.locationId, locationId),
        between(rosterAssignment.workDate, from, to),
        eq(rosterAssignment.kind, "work"),
        eq(roster.status, "confirmed"),
        eq(rosterRequest.status, "approved"),
      ),
    );

  const targets = await db
    .select({
      departmentId: department.id,
      departmentName: department.name,
      positionId: position.id,
      positionName: position.name,
      date: rosterShiftTarget.workDate,
      shiftId: shift.id,
      shiftOrder: shift.order,
      headcount: rosterShiftTarget.headcount,
    })
    .from(rosterShiftTarget)
    .innerJoin(roster, eq(roster.id, rosterShiftTarget.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .innerJoin(rosterRequestLine, eq(rosterRequestLine.id, rosterShiftTarget.requestLineId))
    .innerJoin(department, eq(department.id, rosterRequestLine.departmentId))
    .innerJoin(position, eq(position.id, rosterRequestLine.positionId))
    .innerJoin(shift, eq(shift.id, rosterShiftTarget.shiftId))
    .where(
      and(
        eq(rosterRequest.locationId, locationId),
        between(rosterShiftTarget.workDate, from, to),
        gt(rosterShiftTarget.headcount, 0),
        eq(roster.status, "confirmed"),
        eq(rosterRequest.status, "approved"),
      ),
    );

  // A shift deleted after the day has no place among the active ones, but its rows still need a
  // column, so every shift the rows use is added once.
  const shifts = new Map(activeShifts.map((entry) => [entry.id, entry]));

  for (const row of [...assignments, ...targets]) {
    if (!shifts.has(row.shiftId)) {
      shifts.set(row.shiftId, { id: row.shiftId, order: row.shiftOrder });
    }
  }

  return {
    locationName: place.name,
    from,
    to,
    shifts: [...shifts.values()].sort(
      (a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    ),
    assignments,
    targets,
  };
}
