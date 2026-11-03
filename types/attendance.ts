import type { AppRole } from "@/types/roles";

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

export type AttendanceActionResult =
  | { ok: true; saved: number; cleared: number }
  | { ok: false; formError: string; entryErrors?: Record<number, string> };
