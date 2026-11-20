import "server-only";
import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { attendance, attendanceSubstitute } from "@/database/schema/attendance-schema";
import { location } from "@/database/schema/location-schema";
import { position } from "@/database/schema/position-schema";
import { rosterRequest, rosterRequestLine } from "@/database/schema/request-schema";
import { roster, rosterAssignment } from "@/database/schema/roster-schema";
import { shift } from "@/database/schema/shift-schema";
import { worker } from "@/database/schema/worker-schema";
import type {
  AttendanceStatus,
  SubstituteCandidateContext,
  SubstituteTarget,
} from "@/types/attendance";
import type { Reader } from "@/types/rosters";
import { loadHistories, loadWorkerPositions } from "../rosters/rosters";

// Reads the scheduled row that an absent worker's replacement would cover. It does not filter on the
// roster or request status: it returns them, and the action applies scheduledWorkError.
//
// With lock, the roster and its request are share-locked the way saveAttendance does, and the
// attendance row is locked for update. The reader must then be a transaction, so the locks last
// until the caller commits.
export async function loadSubstituteTarget(
  reader: Reader,
  assignmentId: string,
  options: { lock?: boolean } = {},
): Promise<SubstituteTarget | null> {
  const query = reader
    .select({
      assignmentId: rosterAssignment.id,
      attendanceId: attendance.id,
      status: attendance.status,
      workerId: rosterAssignment.workerId,
      date: rosterAssignment.workDate,
      locationId: location.id,
      timezone: location.timezone,
      rosterStatus: roster.status,
      requestStatus: rosterRequest.status,
      kind: rosterAssignment.kind,
      shiftOrder: shift.order,
      positionId: position.id,
      positionName: position.name,
      departmentId: rosterRequestLine.departmentId,
      subDepartmentId: rosterRequestLine.subDepartmentId,
    })
    .from(rosterAssignment)
    .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .innerJoin(location, eq(location.id, rosterRequest.locationId))
    .innerJoin(rosterRequestLine, eq(rosterRequestLine.id, rosterAssignment.requestLineId))
    .innerJoin(position, eq(position.id, rosterRequestLine.positionId))
    .leftJoin(shift, eq(shift.id, rosterAssignment.shiftId))
    .leftJoin(attendance, eq(attendance.rosterAssignmentId, rosterAssignment.id))
    .where(eq(rosterAssignment.id, assignmentId));

  // FOR UPDATE is refused on the nullable side of an outer join, so only the roster and request,
  // which are inner joined, are locked here.
  const [row] = await (options.lock ? query.for("share", { of: [roster, rosterRequest] }) : query);

  if (!row) {
    return null;
  }

  let attendanceId = row.attendanceId;
  let status: AttendanceStatus | null = row.status;

  if (options.lock) {
    // The row can be gone or new since the read above, so the locked read decides.
    const [locked] = await reader
      .select({ id: attendance.id, status: attendance.status })
      .from(attendance)
      .where(eq(attendance.rosterAssignmentId, assignmentId))
      .for("update");

    attendanceId = locked?.id ?? null;
    status = locked?.status ?? null;
  }

  return {
    assignmentId: row.assignmentId,
    attendanceId,
    status,
    workerId: row.workerId,
    date: row.date,
    locationId: row.locationId,
    timezone: row.timezone,
    rosterStatus: row.rosterStatus,
    requestStatus: row.requestStatus,
    kind: row.kind,
    // An off or break row has no shift. The action refuses it before the order is used.
    shiftOrder: row.shiftOrder ?? 0,
    position: { id: row.positionId, name: row.positionName },
    departmentId: row.departmentId,
    subDepartmentId: row.subDepartmentId,
  };
}

// The active workers of the target's location, as candidates to cover it. With candidateIds only
// those workers are loaded, and an id that is not an active worker of this location is simply not
// in the result. The absent worker is not removed here: checkSubstitute rejects them. The engine
// rules are not read here, the action loads them for the location.
export async function loadSubstituteCandidates(
  reader: Reader,
  target: SubstituteTarget,
  options: { candidateIds: string[] | null },
): Promise<SubstituteCandidateContext[]> {
  if (options.candidateIds !== null && options.candidateIds.length === 0) {
    return [];
  }

  const pool = await reader
    .select({
      id: worker.id,
      employeeId: worker.employeeId,
      name: worker.name,
      endContract: worker.endContract,
    })
    .from(worker)
    .where(
      and(
        eq(worker.locationId, target.locationId),
        isNull(worker.deletedAt),
        options.candidateIds ? inArray(worker.id, options.candidateIds) : undefined,
      ),
    )
    .orderBy(asc(worker.employeeId), asc(worker.id));

  if (pool.length === 0) {
    return [];
  }

  const ids = pool.map((entry) => entry.id);

  const [positions, assigned, covering, histories] = await Promise.all([
    loadWorkerPositions(reader, ids),
    // Work on the day in any roster of an approved request. Off and break do not count, and a
    // cancelled request's roster stays on record but binds nobody.
    reader
      .select({ workerId: rosterAssignment.workerId })
      .from(rosterAssignment)
      .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
      .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
      .where(
        and(
          eq(rosterAssignment.workDate, target.date),
          eq(rosterAssignment.kind, "work"),
          eq(rosterRequest.status, "approved"),
          inArray(rosterAssignment.workerId, ids),
        ),
      ),
    // Already the replacement for someone else that day. The target's own replacement is left out,
    // so choosing the same worker again is not blocked by itself.
    reader
      .select({ workerId: attendanceSubstitute.substituteWorkerId })
      .from(attendanceSubstitute)
      .where(
        and(
          eq(attendanceSubstitute.workDate, target.date),
          inArray(attendanceSubstitute.substituteWorkerId, ids),
          target.attendanceId
            ? ne(attendanceSubstitute.attendanceId, target.attendanceId)
            : undefined,
        ),
      ),
    loadHistories(reader, ids, [target.date]),
  ]);

  const assignedIds = new Set(assigned.map((row) => row.workerId));
  const coveringIds = new Set(covering.map((row) => row.workerId));

  return pool.map((entry, index) => ({
    id: entry.id,
    employeeId: entry.employeeId,
    name: entry.name,
    positionIds: positions.get(entry.id)?.ids ?? [],
    positionNames: positions.get(entry.id)?.names ?? [],
    endContract: entry.endContract,
    deleted: false,
    locationId: target.locationId,
    workDatesToday: assignedIds.has(entry.id),
    alreadyCovering: coveringIds.has(entry.id),
    history: histories[index],
  }));
}
