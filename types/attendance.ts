import type { AppRole } from "@/types/roles";
import type { LocationTimezone } from "@/validation/location";

export type AttendanceStatus = "present" | "absent" | "sick" | "leave";

export type AttendanceStatusFilter = "all" | "not-marked" | AttendanceStatus;

// The filters of the Attendance page, read from the URL. date is YYYY-MM-DD.
export type AttendanceFilters = {
  date: string;
  siteId: string | null;
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

// siteId null means every site, which only a superadmin has. locationId is set for admin site only.
export type AttendanceAccess = {
  userId: string;
  role: AppRole;
  siteId: string | null;
  locationId: string | null;
};

export type AttendanceSummary = {
  scheduled: number;
  present: number;
  absent: number;
  sick: number;
  leave: number;
  notMarked: number;
};

// A row of the form while the admin edits: the assignment and what the admin has chosen so far.
export type AttendanceDraftRow = {
  assignmentId: string;
  status: AttendanceStatus | null;
  reason: string | null;
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
  siteName: string;
  shiftOrder: number;
  shiftName: string;
  startTime: string;
  endTime: string;
  status: AttendanceStatus | null;
  reason: string | null;
};

// A row as the query returns it: the times are still HH:mm:ss, and the ids the filters need are
// still there.
export type AttendanceJoinedRow = Omit<AttendanceRow, "status"> & {
  departmentId: string;
  shiftId: string;
  status: string | null;
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

// What the page offers in its filters, and the site and location it resolved to. Null means All, or
// that the access allows none.
export type AttendanceChoices = {
  siteId: string | null;
  locationId: string | null;
  sites: { id: string; name: string }[];
  locations: { id: string; name: string; siteId: string; timezone: LocationTimezone }[];
  departments: { id: string; name: string }[];
  shifts: { id: string; name: string }[];
};

// The saved values plus what the admin has chosen so far in the form.
export type AttendanceFormRow = AttendanceRow & {
  draftStatus: AttendanceStatus | null;
  draftReason: string;
};

export type AttendanceFormProps = {
  date: string;
  // Today in the location's time zone, for the Today button.
  today: string;
  rows: AttendanceRow[];
  // True for a day after today, which can be viewed and not marked.
  readOnly: boolean;
};

export type AttendanceDateRowProps = {
  date: string;
  today: string;
  canSave: boolean;
  canMarkAll: boolean;
  onMarkAll: () => void;
  onSave: () => void;
  isSaving: boolean;
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
  // Rows the server refused in the last save, and rows changed since the last save.
  errorIds: ReadonlySet<string>;
  changedIds: ReadonlySet<string>;
  disabled: boolean;
};

export type AttendanceCardsProps = AttendanceRowActions & { rows: AttendanceFormRow[] };

export type AttendanceActionResult =
  | { ok: true; saved: number; cleared: number }
  | { ok: false; formError: string; entryErrors?: Record<number, string> };
