import { z } from "zod";

import type {
  HistoryAttendanceFilter,
  HistoryTypeFilter,
  WorkerHistoryFilters,
  WorkerHistorySearchParams,
} from "@/types/worker-history";

import { ATTENDANCE_STATUS_VALUES } from "./attendance";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// PostgreSQL has no year 0000, and Date.UTC reads years 0 to 99 as 1900 to 1999, so an earlier month
// is not a month anyone has rosters in.
const FIRST_YEAR = 2000;

const TYPES: readonly string[] = ["work", "off", "break"];

const ATTENDANCE: readonly string[] = ["not-marked", ...ATTENDANCE_STATUS_VALUES];

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function uuidOrNull(value: string | string[] | undefined): string | null {
  const first = firstValue(value);

  return z.string().uuid().safeParse(first).success ? first : null;
}

// A month that is malformed, before FIRST_YEAR, or after the current one becomes the current month.
// Dates compare as text because YYYY-MM sorts the same way.
function monthOrCurrent(value: string | string[] | undefined, today: string): string {
  const current = today.slice(0, 7);
  const month = firstValue(value);

  return MONTH_PATTERN.test(month) && Number(month.slice(0, 4)) >= FIRST_YEAR && month <= current
    ? month
    : current;
}

// Reads the worker detail filters from the URL. Anything unknown falls back to its default, so a
// bad link shows this month and every day instead of an error. Page and sort are read elsewhere.
export function parseWorkerHistoryParams(params: WorkerHistorySearchParams, today: string): WorkerHistoryFilters {
  const type = firstValue(params.type);
  const attendance = firstValue(params.attendance);

  return {
    month: monthOrCurrent(params.month, today),
    departmentId: uuidOrNull(params.department),
    shiftId: uuidOrNull(params.shift),
    type: TYPES.includes(type) ? (type as HistoryTypeFilter) : "all",
    attendance: ATTENDANCE.includes(attendance) ? (attendance as HistoryAttendanceFilter) : "all",
  };
}
