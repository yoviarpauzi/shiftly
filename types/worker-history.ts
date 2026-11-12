import type { ReactNode } from "react";
import type { AttendanceStatus } from "@/types/attendance";
import type { SortCriterion } from "@/types/sort";
import type { WorkerFormOptions, WorkerRow } from "@/types/workers";

export type HistoryKind = "work" | "off" | "break";

// A work day with no attendance row is "not-marked". Off and break days have no attendance at all.
export type HistoryAttendance = AttendanceStatus | "not-marked";

// Times are HH:MM.
export type WorkerHistoryShift = {
  id: string;
  order: number;
  name: string;
  startTime: string;
  endTime: string;
};

export type WorkerHistoryRow = {
  assignmentId: string;
  // YYYY-MM-DD.
  date: string;
  kind: HistoryKind;
  // Null for off and break.
  shift: WorkerHistoryShift | null;
  departmentId: string;
  departmentName: string;
  subDepartmentName: string | null;
  positionName: string;
  rosterId: string;
  poNumber: string;
  // Null for off and break.
  attendance: HistoryAttendance | null;
};

// One row as the history query returns it. Times are as stored (HH:MM:SS).
export type WorkerHistoryJoinedRow = {
  assignmentId: string;
  date: string;
  kind: HistoryKind;
  shiftId: string | null;
  shiftOrder: number | null;
  shiftName: string | null;
  startTime: string | null;
  endTime: string | null;
  departmentId: string;
  departmentName: string;
  subDepartmentName: string | null;
  positionName: string;
  rosterId: string;
  poNumber: string;
  attendanceStatus: string | null;
};

export type HistoryAttendanceFilter = "all" | HistoryAttendance;

// The filters of the worker detail page, read from the URL. month is YYYY-MM.
export type WorkerHistoryFilters = {
  month: string;
  departmentId: string | null;
  shiftId: string | null;
  attendance: HistoryAttendanceFilter;
};

export type WorkerHistorySummary = {
  shiftsWorked: number;
  offDays: number;
  breakDays: number;
  present: number;
  absent: number;
  sick: number;
  leave: number;
  notMarked: number;
};

export type WorkerHistoryChoices = {
  departments: { id: string; name: string }[];
  shifts: { id: string; order: number; name: string }[];
};

export type WorkerHistoryView = {
  rows: WorkerHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: WorkerHistorySummary;
  choices: WorkerHistoryChoices;
};

// workDays is the effective working days per week: the worker's own value, else the work rule's.
export type WorkerDetail = WorkerRow & { timezone: string; workDays: number };

// The URL's search params, as Next.js hands them to a page.
export type WorkerHistorySearchParams = Record<string, string | string[] | undefined>;

export type WorkerProfileCardProps = { worker: WorkerDetail };

export type WorkerProfileFieldProps = { label: string; children: ReactNode };

export type EditWorkerButtonProps = { worker: WorkerRow; options: WorkerFormOptions };

export type HistoryMonthNavProps = {
  workerId: string;
  // The URL's params, so the other filters survive a change of month.
  params: WorkerHistorySearchParams;
  month: string;
  today: string;
};

export type HistorySummaryProps = { summary: WorkerHistorySummary };

export type HistoryAttendanceBadgeProps = { attendance: HistoryAttendance | null };

export type HistorySortColumn = "date";

export type HistoryCellProps = { row: WorkerHistoryRow };

export type HistoryFiltersProps = {
  // The URL's params, so Clear filters keeps the month and the sort.
  workerId: string;
  params: WorkerHistorySearchParams;
  filters: WorkerHistoryFilters;
  choices: WorkerHistoryChoices;
};

export type HistoryTableProps = {
  data: WorkerHistoryView;
  sort: SortCriterion<HistorySortColumn>[];
};

export type HistoryPagerProps = {
  page: number;
  pageSize: number;
  // Days that match the filters, and every day of the month.
  total: number;
  monthTotal: number;
};

export type HistoryCardsProps = { rows: WorkerHistoryRow[] };

// none: never in a confirmed roster. month: nothing in the chosen month. filtered: the filters match nothing.
export type HistoryEmptyProps =
  | { kind: "none"; workerName: string }
  | { kind: "month"; monthLabel: string }
  | { kind: "filtered"; clearHref: string };
