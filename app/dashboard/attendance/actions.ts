"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { eq, inArray, sql } from "drizzle-orm";
import { attendance, attendanceSubstitute } from "@/database/schema/attendance-schema";
import { location } from "@/database/schema/location-schema";
import { rosterRequest } from "@/database/schema/request-schema";
import { roster, rosterAssignment } from "@/database/schema/roster-schema";
import { isUniqueViolation } from "@/error/db-error";
import { db } from "@/lib/db";
import { dateInZone } from "@/lib/indonesia-date";
import type { AttendanceActionResult, SubstituteActionResult } from "@/types/attendance";
import type { ReplaceOption } from "@/types/rosters";
import { locationTimezoneSchema } from "@/validation/location";
import {
  listSubstituteCandidatesSchema,
  saveAttendanceSchema,
  setSubstituteSchema,
  type ListSubstituteCandidatesInput,
  type SaveAttendanceInput,
  type SetSubstituteInput,
} from "@/validation/attendance";
import { INVALID_TIMEZONE_MESSAGE } from "../requests/request-rules";
import { loadEngineRules } from "../rosters/roster-work-rules";
import { canAccessAttendanceLocation } from "./attendance-access";
import { requireAttendanceAccess } from "./attendance-guard";
import {
  ATTENDANCE_NOT_FOUND_MESSAGE,
  FUTURE_DAY_MESSAGE,
  isFutureDay,
  scheduledWorkError,
} from "./attendance-rules";
import { loadSubstituteCandidates, loadSubstituteTarget } from "./attendance-substitute";
import {
  checkSubstitute,
  NEEDS_ABSENT_MESSAGE,
  SUBSTITUTE_COVERS_MESSAGE,
  SUBSTITUTE_MESSAGES,
} from "./attendance-substitute-rules";

const ATTENDANCE_PATH = "/dashboard/attendance";

// Marks, changes, and clears attendance for one day. An entry with a status is saved, and one with
// no status deletes the row, which puts the worker back to Not marked. Every entry is checked
// before anything is written, so one bad entry saves nothing.
export async function saveAttendance(input: SaveAttendanceInput): Promise<AttendanceActionResult> {
  const access = await requireAttendanceAccess();
  const parsed = saveAttendanceSchema.safeParse(input);

  if (!parsed.success) {
    const entryErrors: Record<number, string> = {};

    for (const issue of parsed.error.issues) {
      const [field, index] = issue.path;

      if (field === "entries" && typeof index === "number" && !(index in entryErrors)) {
        entryErrors[index] = issue.message;
      }
    }

    return {
      ok: false,
      formError: parsed.error.issues[0]?.message ?? "Invalid input",
      ...(Object.keys(entryErrors).length > 0 && { entryErrors }),
    };
  }

  const { date, entries } = parsed.data;
  const ids = entries.map((entry) => entry.assignmentId);

  const result = await db.transaction(async (tx): Promise<AttendanceActionResult> => {
    // The share lock on the rosters and their requests keeps either from changing between this read
    // and the write: a confirmed roster is fixed, but a request can still be cancelled, and that
    // waits until this save commits.
    const found = await tx
      .select({
        id: rosterAssignment.id,
        kind: rosterAssignment.kind,
        workDate: rosterAssignment.workDate,
        rosterStatus: roster.status,
        requestStatus: rosterRequest.status,
        locationId: location.id,
        timezone: location.timezone,
      })
      .from(rosterAssignment)
      .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
      .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
      .innerJoin(location, eq(location.id, rosterRequest.locationId))
      .where(inArray(rosterAssignment.id, ids))
      .for("share", { of: [roster, rosterRequest] });

    const byId = new Map(found.map((row) => [row.id, row]));
    const locations = new Map(found.map((row) => [row.locationId, row]));

    // A missing assignment, one outside the access, and a mix of locations all look the same, so
    // the answer does not tell a caller what exists elsewhere.
    if (
      byId.size !== ids.length ||
      locations.size !== 1 ||
      ![...locations.values()].every((row) =>
        canAccessAttendanceLocation(access, { id: row.locationId }),
      )
    ) {
      return { ok: false, formError: ATTENDANCE_NOT_FOUND_MESSAGE };
    }

    const [{ timezone }] = found;
    const zone = locationTimezoneSchema.safeParse(timezone);

    if (!zone.success) {
      return { ok: false, formError: INVALID_TIMEZONE_MESSAGE };
    }

    if (isFutureDay(date, dateInZone(zone.data))) {
      return { ok: false, formError: FUTURE_DAY_MESSAGE };
    }

    const entryErrors: Record<number, string> = {};

    entries.forEach((entry, index) => {
      const error = scheduledWorkError(byId.get(entry.assignmentId)!, date);

      if (error) {
        entryErrors[index] = error;
      }
    });

    const firstError = Object.values(entryErrors)[0];

    if (firstError) {
      return { ok: false, formError: firstError, entryErrors };
    }

    // In assignment id order, so two saves that overlap lock the same rows in the same order and
    // cannot deadlock on the unique index.
    const marked = entries
      .filter((entry) => entry.status !== null)
      .sort((a, b) => (a.assignmentId < b.assignmentId ? -1 : a.assignmentId > b.assignmentId ? 1 : 0));
    const cleared = entries.filter((entry) => entry.status === null);

    if (marked.length > 0) {
      // markedBy is only set on insert. An update keeps who marked it first, and takes the new
      // editor and time.
      await tx
        .insert(attendance)
        .values(
          marked.map((entry) => ({
            rosterAssignmentId: entry.assignmentId,
            status: entry.status!,
            reason: entry.reason,
            markedBy: access.userId,
            updatedBy: access.userId,
          })),
        )
        .onConflictDoUpdate({
          target: attendance.rosterAssignmentId,
          set: {
            status: sql`excluded.status`,
            reason: sql`excluded.reason`,
            updatedBy: access.userId,
            updatedAt: new Date(),
          },
        });

      // A worker marked Present did work, so nobody covers them. The rows are removed after the
      // upsert has locked the attendance rows, and in the same transaction. Clearing needs no such
      // statement: deleting the attendance row cascades to its replacement.
      const present = marked.filter((entry) => entry.status === "present");

      if (present.length > 0) {
        await tx.delete(attendanceSubstitute).where(
          sql`${attendanceSubstitute.attendanceId} in (select ${attendance.id} from ${attendance} where ${inArray(
            attendance.rosterAssignmentId,
            present.map((entry) => entry.assignmentId),
          )})`,
        );
      }
    }

    if (cleared.length > 0) {
      await tx.delete(attendance).where(
        inArray(
          attendance.rosterAssignmentId,
          cleared.map((entry) => entry.assignmentId),
        ),
      );
    }

    return { ok: true, saved: marked.length, cleared: cleared.length };
  });

  if (result.ok) {
    revalidatePath(ATTENDANCE_PATH);
  }

  return result;
}

// The workers who could cover an absent worker, each with the reasons that block the choice (hard)
// and the roster rules it would break (warnings). Read only. Anything the caller may not see, or a
// row that is not Absent, gives an empty list, so the answer does not tell what exists elsewhere.
export async function listSubstituteCandidates(
  input: ListSubstituteCandidatesInput,
): Promise<ReplaceOption[]> {
  const access = await requireAttendanceAccess();
  const parsed = listSubstituteCandidatesSchema.safeParse(input);

  if (!parsed.success) {
    return [];
  }

  const target = await loadSubstituteTarget(db, parsed.data.assignmentId);

  if (
    !target ||
    !canAccessAttendanceLocation(access, { id: target.locationId }) ||
    scheduledWorkError(
      {
        kind: target.kind,
        workDate: target.date,
        rosterStatus: target.rosterStatus,
        requestStatus: target.requestStatus,
      },
      target.date,
    ) ||
    target.status !== "absent"
  ) {
    return [];
  }

  const [candidates, rules] = await Promise.all([
    loadSubstituteCandidates(db, target, { candidateIds: null }),
    loadEngineRules(db, { locationId: target.locationId }),
  ]);

  return candidates
    .filter((candidate) => candidate.id !== target.workerId)
    .map((candidate) => ({
      workerId: candidate.id,
      employeeId: candidate.employeeId,
      name: candidate.name,
      positionNames: candidate.positionNames,
      ...checkSubstitute({
        date: target.date,
        absentWorkerId: target.workerId,
        absentShiftOrder: target.shiftOrder,
        position: target.position,
        rules,
        candidate,
        locationId: target.locationId,
        workDatesToday: candidate.workDatesToday,
        alreadyCovering: candidate.alreadyCovering,
        history: candidate.history,
      }),
    }));
}

// Sets, changes, or removes the worker who covers an absent worker for the day. The row is read
// again under lock inside the transaction, so a change to the roster, the request, or the status
// at the same moment waits for this save. A hard reason refuses the choice, and a warning is only
// returned.
export async function setSubstitute(input: SetSubstituteInput): Promise<SubstituteActionResult> {
  const access = await requireAttendanceAccess();
  const parsed = setSubstituteSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, formError: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { assignmentId, substituteWorkerId } = parsed.data;
  let result: SubstituteActionResult;

  try {
    result = await db.transaction(async (tx): Promise<SubstituteActionResult> => {
      const target = await loadSubstituteTarget(tx, assignmentId, { lock: true });

      if (!target || !canAccessAttendanceLocation(access, { id: target.locationId })) {
        return { ok: false, formError: ATTENDANCE_NOT_FOUND_MESSAGE };
      }

      const scheduleError = scheduledWorkError(
        {
          kind: target.kind,
          workDate: target.date,
          rosterStatus: target.rosterStatus,
          requestStatus: target.requestStatus,
        },
        target.date,
      );

      if (scheduleError) {
        return { ok: false, formError: scheduleError };
      }

      const zone = locationTimezoneSchema.safeParse(target.timezone);

      if (!zone.success) {
        return { ok: false, formError: INVALID_TIMEZONE_MESSAGE };
      }

      if (isFutureDay(target.date, dateInZone(zone.data))) {
        return { ok: false, formError: FUTURE_DAY_MESSAGE };
      }

      if (target.status !== "absent" || target.attendanceId === null) {
        return { ok: false, formError: NEEDS_ABSENT_MESSAGE };
      }

      if (substituteWorkerId === null) {
        await tx
          .delete(attendanceSubstitute)
          .where(eq(attendanceSubstitute.attendanceId, target.attendanceId));

        return { ok: true, warnings: [] };
      }

      const [candidate] = await loadSubstituteCandidates(tx, target, {
        candidateIds: [substituteWorkerId],
      });

      if (!candidate) {
        return { ok: false, formError: SUBSTITUTE_MESSAGES.notAvailable };
      }

      const rules = await loadEngineRules(tx, { locationId: target.locationId });
      const { hard, warnings } = checkSubstitute({
        date: target.date,
        absentWorkerId: target.workerId,
        absentShiftOrder: target.shiftOrder,
        position: target.position,
        rules,
        candidate,
        locationId: target.locationId,
        workDatesToday: candidate.workDatesToday,
        alreadyCovering: candidate.alreadyCovering,
        history: candidate.history,
      });

      if (hard.length > 0) {
        return { ok: false, formError: hard.join(" ") };
      }

      // One replacement per absent row: choosing again swaps the worker and takes the new editor
      // and time.
      await tx
        .insert(attendanceSubstitute)
        .values({
          attendanceId: target.attendanceId,
          substituteWorkerId,
          workDate: target.date,
          createdBy: access.userId,
        })
        .onConflictDoUpdate({
          target: attendanceSubstitute.attendanceId,
          set: { substituteWorkerId, createdBy: access.userId, createdAt: new Date() },
        });

      return { ok: true, warnings };
    });
  } catch (error) {
    // A unique violation aborts the transaction, so it is caught out here, after the rollback.
    if (isUniqueViolation(error)) {
      return { ok: false, formError: SUBSTITUTE_COVERS_MESSAGE };
    }

    throw error;
  }

  if (result.ok) {
    revalidatePath(ATTENDANCE_PATH);
  }

  return result;
}
