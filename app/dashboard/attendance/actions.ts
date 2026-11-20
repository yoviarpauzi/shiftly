"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { eq, inArray, sql } from "drizzle-orm";
import { attendance } from "@/database/schema/attendance-schema";
import { location } from "@/database/schema/location-schema";
import { rosterRequest } from "@/database/schema/request-schema";
import { roster, rosterAssignment } from "@/database/schema/roster-schema";
import { db } from "@/lib/db";
import { dateInZone } from "@/lib/indonesia-date";
import type { AttendanceActionResult } from "@/types/attendance";
import { locationTimezoneSchema } from "@/validation/location";
import { saveAttendanceSchema, type SaveAttendanceInput } from "@/validation/attendance";
import { INVALID_TIMEZONE_MESSAGE } from "../requests/request-rules";
import { canAccessAttendanceLocation } from "./attendance-access";
import { requireAttendanceAccess } from "./attendance-guard";
import {
  ATTENDANCE_NOT_FOUND_MESSAGE,
  FUTURE_DAY_MESSAGE,
  isFutureDay,
  scheduledWorkError,
} from "./attendance-rules";

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
        siteId: location.siteId,
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
        canAccessAttendanceLocation(access, { id: row.locationId, siteId: row.siteId }),
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
