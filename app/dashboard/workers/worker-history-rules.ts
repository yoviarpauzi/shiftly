import { toHourMinute } from "@/app/dashboard/shifts/shift-rules";
import { clampPage } from "@/lib/pagination";
import { dateInZone } from "@/lib/indonesia-date";
import type { SortDirection } from "@/types/sort";
import type {
  HistoryAttendance,
  WorkerHistoryChoices,
  WorkerHistoryFilters,
  WorkerHistoryJoinedRow,
  WorkerHistoryRow,
  WorkerHistorySummary,
  WorkerHistoryView,
} from "@/types/worker-history";
import { DEFAULT_LOCATION_TIMEZONE, locationTimezoneSchema } from "@/validation/location";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// The first day of the month, and its last day capped at today: a day after today is not history.
// The names come from Date.UTC, so they never depend on the server's locale.
export function monthBounds(month: string, today: string): { from: string; to: string } {
  const [year, number] = month.split("-").map(Number);
  const last = `${month}-${pad(new Date(Date.UTC(year, number, 0)).getUTCDate())}`;

  return { from: `${month}-01`, to: last < today ? last : today };
}

export function shiftMonth(month: string, delta: -1 | 1): string {
  const [year, number] = month.split("-").map(Number);
  const moved = new Date(Date.UTC(year, number - 1 + delta, 1));

  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}`;
}

export function monthLabel(month: string): string {
  const [year, number] = month.split("-").map(Number);

  return `${MONTHS[number - 1]} ${year}`;
}

export function weekdayName(date: string): string {
  const [year, month, day] = date.split("-").map(Number);

  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

// Today in the worker's location zone. A zone the app does not know falls back to the default.
export function workerToday(timezone: string, now: Date = new Date()): string {
  const zone = locationTimezoneSchema.safeParse(timezone);

  return dateInZone(zone.success ? zone.data : DEFAULT_LOCATION_TIMEZONE, now);
}

// A work day without an attendance row is not marked yet. Off and break days have neither a shift
// nor attendance.
export function toHistoryRows(joined: WorkerHistoryJoinedRow[]): WorkerHistoryRow[] {
  return joined.map((entry) => {
    const hasShift =
      entry.shiftId !== null &&
      entry.shiftOrder !== null &&
      entry.shiftName !== null &&
      entry.startTime !== null &&
      entry.endTime !== null;
    const work = entry.kind === "work";

    return {
      assignmentId: entry.assignmentId,
      date: entry.date,
      kind: entry.kind,
      shift: hasShift
        ? {
            id: entry.shiftId as string,
            order: entry.shiftOrder as number,
            name: entry.shiftName as string,
            startTime: toHourMinute(entry.startTime as string),
            endTime: toHourMinute(entry.endTime as string),
          }
        : null,
      departmentId: entry.departmentId,
      departmentName: entry.departmentName,
      subDepartmentName: entry.subDepartmentName,
      positionName: entry.positionName,
      rosterId: entry.rosterId,
      poNumber: entry.poNumber,
      attendance: work ? ((entry.attendanceStatus ?? "not-marked") as HistoryAttendance) : null,
    };
  });
}

export function summarizeHistory(rows: WorkerHistoryRow[]): WorkerHistorySummary {
  const summary: WorkerHistorySummary = {
    shiftsWorked: 0,
    offDays: 0,
    breakDays: 0,
    present: 0,
    absent: 0,
    sick: 0,
    leave: 0,
    notMarked: 0,
  };

  for (const entry of rows) {
    if (entry.kind === "off") {
      summary.offDays += 1;
    } else if (entry.kind === "break") {
      summary.breakDays += 1;
    } else {
      summary.shiftsWorked += 1;

      if (entry.attendance === "not-marked") {
        summary.notMarked += 1;
      } else if (entry.attendance) {
        summary[entry.attendance] += 1;
      }
    }
  }

  return summary;
}

export function filterHistory(
  rows: WorkerHistoryRow[],
  filters: WorkerHistoryFilters,
): WorkerHistoryRow[] {
  return rows.filter(
    (entry) =>
      (!filters.departmentId || entry.departmentId === filters.departmentId) &&
      (!filters.shiftId || entry.shift?.id === filters.shiftId) &&
      (filters.type === "all" || entry.kind === filters.type) &&
      (filters.attendance === "all" || entry.attendance === filters.attendance),
  );
}

// By date in the given direction, then shift order (no shift last), then assignment id, so rows on
// one date never change places between loads.
export function sortHistory(rows: WorkerHistoryRow[], direction: SortDirection): WorkerHistoryRow[] {
  const sign = direction === "asc" ? 1 : -1;

  return [...rows].sort(
    (a, b) =>
      sign * compare(a.date, b.date) ||
      (a.shift?.order ?? Number.MAX_SAFE_INTEGER) - (b.shift?.order ?? Number.MAX_SAFE_INTEGER) ||
      compare(a.assignmentId, b.assignmentId),
  );
}

// What the filters offer: the departments and shifts the rows actually use, deleted ones included.
export function historyChoices(rows: WorkerHistoryRow[]): WorkerHistoryChoices {
  const departments = new Map<string, string>();
  const shifts = new Map<string, { id: string; order: number; name: string }>();

  for (const entry of rows) {
    departments.set(entry.departmentId, entry.departmentName);

    if (entry.shift) {
      shifts.set(entry.shift.id, {
        id: entry.shift.id,
        order: entry.shift.order,
        name: entry.shift.name,
      });
    }
  }

  return {
    departments: [...departments]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => compare(a.name.toLowerCase(), b.name.toLowerCase()) || compare(a.id, b.id)),
    shifts: [...shifts.values()].sort((a, b) => a.order - b.order || compare(a.id, b.id)),
  };
}

// A department or shift in the URL that the month's rows do not use is not a choice the filter
// can show, so it counts as not set. Month navigation keeps the filters, and this keeps a month that
// never used the department from showing a select with a value it does not list.
export function narrowFilters(
  filters: WorkerHistoryFilters,
  choices: WorkerHistoryChoices,
): WorkerHistoryFilters {
  return {
    ...filters,
    departmentId: choices.departments.some((entry) => entry.id === filters.departmentId)
      ? filters.departmentId
      : null,
    shiftId: choices.shifts.some((entry) => entry.id === filters.shiftId) ? filters.shiftId : null,
  };
}

// The summary and the choices describe the whole month, so they stay put while a filter changes.
// The rows and the total follow the filters.
export function buildWorkerHistory(
  rows: WorkerHistoryRow[],
  filters: WorkerHistoryFilters,
  paging: { page: number; pageSize: number; direction: SortDirection },
): WorkerHistoryView {
  const filtered = sortHistory(filterHistory(rows, filters), paging.direction);
  const page = clampPage(paging.page, filtered.length, paging.pageSize);

  return {
    rows: filtered.slice((page - 1) * paging.pageSize, page * paging.pageSize),
    total: filtered.length,
    page,
    pageSize: paging.pageSize,
    summary: summarizeHistory(rows),
    choices: historyChoices(rows),
  };
}

// The detail page's URL with some params changed. The page number goes too, since the list changes.
// A null change removes its key.
export function historyHref(
  workerId: string,
  params: Record<string, string | string[] | undefined>,
  changes: Record<string, string | null>,
): string {
  const next = new URLSearchParams();
  const applied = new Set<string>();

  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value === undefined) {
      continue;
    }

    if (key in changes) {
      applied.add(key);

      if (changes[key] !== null) {
        next.append(key, changes[key]);
      }

      continue;
    }

    for (const item of Array.isArray(value) ? value : [value]) {
      next.append(key, item);
    }
  }

  for (const [key, value] of Object.entries(changes)) {
    if (!applied.has(key) && value !== null) {
      next.append(key, value);
    }
  }

  const query = next.toString();

  return query ? `/dashboard/workers/${workerId}?${query}` : `/dashboard/workers/${workerId}`;
}

// The sort header is a two-state toggle: the default newest-first order is a real sort, so a click
// always changes the order and there is no third state that looks the same as the default.
export function oppositeDirection(direction: SortDirection): SortDirection {
  return direction === "asc" ? "desc" : "asc";
}

// "12 days", "1 day", or "2 of 6 days" while a filter narrows the month.
export function daysText(total: number, monthTotal: number): string {
  const noun = monthTotal === 1 ? "day" : "days";

  return total === monthTotal ? `${total} ${noun}` : `${total} of ${monthTotal} ${noun}`;
}
