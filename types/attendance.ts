import type { ReactNode } from "react";
import type { AppRole } from "@/types/roles";
import type { EngineHistory } from "@/types/rosters";
import type { LocationTimezone } from "@/validation/location";

export type AttendanceStatus = "present" | "absent";

export type AttendanceStatusFilter = "all" | "not-marked" | AttendanceStatus;

// The filters of the Attendance page, read from the URL. date is YYYY-MM-DD.
export type AttendanceFilters = {
  date: string;
  locationId: string | null;
  departmentId: string | null;
  shiftId: string | null;
  status: AttendanceStatusFilter;
  query: string;
};

// One worker's record for the day. A null status means Not marked, which has no row.
export type AttendanceEntry = {
  assignmentId: string;
  status: AttendanceStatus | null;
  reason: string | null;
};

// locationId null means every location, which only HO has. It is set for admin site.
export type AttendanceAccess = {
  userId: string;
  role: AppRole;
  locationId: string | null;
};

export type AttendanceSummary = {
  scheduled: number;
  present: number;
  absent: number;
  notMarked: number;
  // Absent workers a replacement covers. They count as having worked.
  covered: number;
};

// A row of the form while the admin edits: the assignment and what the admin has chosen so far.
export type AttendanceDraftRow = {
  assignmentId: string;
  status: AttendanceStatus | null;
  reason: string | null;
};

// The worker who covers an absent one for the day. id is the attendance_substitute row.
export type AttendanceSubstitute = {
  id: string;
  workerId: string;
  employeeId: string;
  name: string;
};

// One scheduled worker for the day, as the page lists them. startTime and endTime are HH:mm.
export type AttendanceRow = {
  assignmentId: string;
  employeeId: string;
  workerName: string;
  departmentName: string;
  positionName: string;
  // The place of the request, so a list that spans locations can tell the rows apart.
  locationName: string;
  shiftOrder: number;
  shiftName: string;
  startTime: string;
  endTime: string;
  status: AttendanceStatus | null;
  reason: string | null;
  // Who covers this worker, or null. Only an Absent row can have one.
  substitute: AttendanceSubstitute | null;
};

// A row as the query returns it: the times are still HH:mm:ss, the ids the filters need are still
// there, and the replacement is four flat columns, all null when there is none.
export type AttendanceJoinedRow = Omit<AttendanceRow, "status" | "substitute"> & {
  departmentId: string;
  shiftId: string;
  status: string | null;
  substituteId: string | null;
  substituteWorkerId: string | null;
  substituteEmployeeId: string | null;
  substituteName: string | null;
};

export type AttendanceListResult = {
  rows: AttendanceRow[];
  // Counts every worker of the date and scope, before the department, shift, status, and query
  // filters.
  summary: AttendanceSummary;
  // Today in the chosen location's time zone, or in the default zone while the location is All.
  today: string;
  isFuture: boolean;
};

// What the page offers in its filters, and the location it resolved to. Null means All, or that the
// access allows none.
export type AttendanceChoices = {
  locationId: string | null;
  locations: { id: string; name: string; timezone: LocationTimezone }[];
  departments: { id: string; name: string }[];
  shifts: { id: string; name: string }[];
};

// The saved values plus what the admin has chosen so far in the form.
export type AttendanceFormRow = AttendanceRow & {
  draftStatus: AttendanceStatus | null;
  draftReason: string;
};

// Why the page cannot be marked: "future" is a day after today, "scope" is a location not chosen
// yet (All). Null means it can.
export type AttendanceLock = "future" | "scope" | null;

// The Location column: none, or the location name.
export type AttendanceLocationView = "none" | "location";

export type AttendanceFormProps = {
  date: string;
  // Today in the location's time zone, for the Today button.
  today: string;
  rows: AttendanceRow[];
  // The form starts again from `rows` when this changes. It is not a React key, which would also
  // remount the filters below and cost the search box its focus.
  resetKey: string;
  lock: AttendanceLock;
  locationView: AttendanceLocationView;
  // The server-rendered parts that sit between the date row and the table.
  filters: ReactNode;
  summary: ReactNode;
  // Shown in place of the table when there are no rows.
  empty: ReactNode;
  // The Excel export of the chosen location and week, or null while the location is All.
  exportHref: string | null;
};

export type AttendanceDateRowProps = {
  date: string;
  today: string;
  canSave: boolean;
  canMarkAll: boolean;
  onMarkAll: () => void;
  onSave: () => void;
  isSaving: boolean;
  exportHref: string | null;
};

export type AttendanceDateButtonProps = {
  // YYYY-MM-DD.
  date: string;
  onPick: (date: string) => void;
};

export type AttendanceFiltersProps = {
  filters: AttendanceFilters;
  choices: AttendanceChoices;
};

export type AttendanceSummaryProps = { summary: AttendanceSummary };

export type AttendanceEmptyProps = { locationName: string };

// What a row of the table or a card does to the form. Both take the row's assignment id.
export type AttendanceRowActions = {
  onStatusChange: (assignmentId: string, status: AttendanceStatus | null) => void;
  onReasonChange: (assignmentId: string, reason: string) => void;
  // Opens the replacement dialog for a saved Absent row.
  onReplace: (row: AttendanceFormRow) => void;
  // Rows the server refused in the last save, and rows changed since the last save.
  errorIds: ReadonlySet<string>;
  changedIds: ReadonlySet<string>;
  disabled: boolean;
  locationView: AttendanceLocationView;
};

export type SubstituteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: AttendanceFormRow | null;
};

// The Replace button of a saved Absent row, or the name of who covers it with a Change button.
export type ReplaceControlProps = {
  row: AttendanceFormRow;
  disabled: boolean;
  onReplace: (row: AttendanceFormRow) => void;
};

export type AttendanceCardsProps = AttendanceRowActions & { rows: AttendanceFormRow[] };

export type AttendanceActionResult =
  | { ok: true; saved: number; cleared: number }
  | { ok: false; formError: string; entryErrors?: Record<number, string> };

export type SubstituteActionResult =
  | { ok: true; warnings: string[] }
  | { ok: false; formError: string };

// The scheduled row an absent worker's replacement would cover, with what the eligibility check and
// the scheduled-work rule need. attendanceId and status are null while the row is Not marked.
// timezone is the raw column value, to be parsed by the caller.
export type SubstituteTarget = {
  assignmentId: string;
  attendanceId: string | null;
  status: AttendanceStatus | null;
  workerId: string;
  date: string;
  locationId: string;
  timezone: string;
  rosterStatus: string;
  requestStatus: string;
  kind: string;
  shiftOrder: number;
  position: { id: string; name: string };
  departmentId: string;
  subDepartmentId: string | null;
};

// One worker of the target's location as a possible replacement, with the facts checkSubstitute
// reads. alreadyCovering ignores the target's own replacement, so choosing it again is allowed.
export type SubstituteCandidateContext = {
  id: string;
  employeeId: string;
  name: string;
  positionIds: string[];
  positionNames: string[];
  endContract: string;
  deleted: false;
  locationId: string;
  workDatesToday: boolean;
  alreadyCovering: boolean;
  history: EngineHistory;
};
