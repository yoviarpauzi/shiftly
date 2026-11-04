import type {
  AttendanceDraftRow,
  AttendanceEntry,
  AttendanceFormRow,
  AttendanceLocationView,
  AttendanceLock,
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

// What makes the form start again from the saved rows: the day, whether one location is chosen, and
// the saved statuses and reasons. Unsaved drafts must not follow the user to another day or into the
// All view, where they would look saved.
export function attendanceFormKey(
  date: string,
  locationId: string | null,
  rows: { assignmentId: string; status: AttendanceStatus | null; reason: string | null }[],
): string {
  return `${date}-${locationId ?? "all"}-${rowsSignature(rows)}`;
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

// Why the day cannot be marked. A location not chosen yet (All) wins over a future day, because
// saving needs one location.
export function attendanceLock(locationId: string | null, isFuture: boolean): AttendanceLock {
  if (locationId === null) return "scope";

  return isFuture ? "future" : null;
}

// What the Location column shows for the scope on screen.
export function locationViewFor(choices: {
  siteId: string | null;
  locationId: string | null;
}): AttendanceLocationView {
  if (choices.locationId !== null) return "none";

  return choices.siteId !== null ? "location" : "site-location";
}

// The text of the Location column. Under All sites it names the site too, because two sites can
// each have a location of the same name.
export function rowLocationLabel(
  row: { siteName: string; locationName: string },
  view: AttendanceLocationView,
): string | null {
  if (view === "none") return null;

  return view === "location" ? row.locationName : `${row.siteName} · ${row.locationName}`;
}

const WEEKDAY_NAMES =["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-11-09" as "Mon, 9 Nov 2026". Fixed English names and UTC arithmetic, so the text does not
// change with the browser's locale or the ICU version. The date is already a real calendar date.
export function formatAttendanceDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return `${WEEKDAY_NAMES[weekday]}, ${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

// Fills Present only where nothing is chosen yet. Every reason and every chosen status stays.
export function markAllPresent(rows: AttendanceDraftRow[]): AttendanceDraftRow[] {
  return rows.map((row) => (row.status === null ? { ...row, status: "present" } : row));
}
