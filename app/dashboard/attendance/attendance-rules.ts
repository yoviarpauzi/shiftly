import type {
  AttendanceDraftRow,
  AttendanceEntry,
  AttendanceFormRow,
  AttendanceStatus,
  AttendanceSummary,
} from "@/types/attendance";

export const FUTURE_DAY_MESSAGE = "You cannot mark attendance for a future day.";
export const NOT_SCHEDULED_MESSAGE = "This worker is not scheduled to work on this day.";
export const ATTENDANCE_NOT_FOUND_MESSAGE = "Attendance not found";

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus | "not-marked", string> = {
  present: "Present",
  absent: "Absent",
  sick: "Sick",
  leave: "Leave",
  "not-marked": "Not marked",
};

// The rows the admin changed, as the entries to save. A row is changed when its status differs from
// the saved one, or when it is marked and its reason differs. A worker set back to Not marked gets
// no reason. A reason typed while nothing is chosen is not saved, so it does not count.
export function changedEntries(rows: AttendanceFormRow[]): AttendanceEntry[] {
  const entries: AttendanceEntry[] = [];

  for (const row of rows) {
    const reason = row.draftStatus === null ? null : row.draftReason.trim() || null;
    const changed = row.draftStatus !== row.status || (row.draftStatus !== null && reason !== row.reason);

    if (changed) {
      entries.push({ assignmentId: row.assignmentId, status: row.draftStatus, reason });
    }
  }

  return entries;
}

// A short text that changes whenever a saved status or reason does. The form is keyed by it, so it
// starts again from the saved values after a save.
export function rowsSignature(
  rows: { assignmentId: string; status: AttendanceStatus | null; reason: string | null }[],
): string {
  const text = rows.map((row) => `${row.assignmentId}:${row.status ?? ""}:${row.reason ?? ""}`).join("|");
  let hash = 5381;

  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash * 33) ^ text.charCodeAt(index)) >>> 0;
  }

  return `${rows.length}-${hash.toString(36)}`;
}

// Whether an assignment can be marked on a date: a work assignment of a confirmed roster, on
// that date, whose request is still approved. Returns the message when it cannot.
export function scheduledWorkError(
  assignment: { kind: string; workDate: string; rosterStatus: string; requestStatus: string },
  date: string,
): string | null {
  const scheduled =
    assignment.kind === "work" &&
    assignment.workDate === date &&
    assignment.rosterStatus === "confirmed" &&
    assignment.requestStatus === "approved";

  return scheduled ? null : NOT_SCHEDULED_MESSAGE;
}

// A row with no status is Not marked, which has no stored record.
export function summarize(rows: { status: AttendanceStatus | null }[]): AttendanceSummary {
  const summary: AttendanceSummary = {
    scheduled: rows.length,
    present: 0,
    absent: 0,
    sick: 0,
    leave: 0,
    notMarked: 0,
  };

  for (const row of rows) {
    if (row.status === null) {
      summary.notMarked += 1;
    } else {
      summary[row.status] += 1;
    }
  }

  return summary;
}

// Both dates are YYYY-MM-DD with zero padding, so a string compare is a date compare. The caller
// passes today in the location's time zone.
export function isFutureDay(date: string, today: string): boolean {
  return date > today;
}

// Fills Present only where nothing is chosen yet. Every reason and every chosen status stays.
export function markAllPresent(rows: AttendanceDraftRow[]): AttendanceDraftRow[] {
  return rows.map((row) => (row.status === null ? { ...row, status: "present" } : row));
}
