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

export type AttendanceActionResult =
  | { ok: true; saved: number; cleared: number }
  | { ok: false; formError: string; entryErrors?: Record<number, string> };
