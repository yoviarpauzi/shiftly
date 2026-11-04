import { dateInZone } from "@/lib/indonesia-date";
import type {
  EngineRules,
  RosterLineFilters,
  RosterLineOption,
  RosterLineOptions,
  RosterLineView,
  RosterPageSlices,
  TargetsTotalError,
} from "@/types/rosters";
import type { WorkRulesResolved } from "@/types/settings";

export const REQUEST_NOT_APPROVED_MESSAGE = "This request is no longer approved.";
export const ROSTER_CONFIRMED_MESSAGE = "This roster is confirmed and cannot be changed.";
export const ROSTER_CHANGED_MESSAGE = "The roster changed. Reload and try again.";
export const ROSTER_NOT_FOUND_MESSAGE = "Roster not found";
export const ROSTER_EXISTS_MESSAGE = "This request already has a roster.";
export const TARGETS_MISMATCH_MESSAGE =
  "The lines, days, or shifts no longer match the request. Reload and try again.";
export const ROSTER_LINE_MISSING_MESSAGE = "That line is not in this roster.";
export const ROSTER_WORKER_MISSING_MESSAGE = "That worker has no shifts on this line.";
export const REPLACEMENT_WORKER_MISSING_MESSAGE = "That worker is not available at this location.";
export const CELL_DATE_MESSAGE = "That day is not in this roster.";
export const CELL_SHIFT_MESSAGE = "That shift is not available at this location.";
export const CELL_OTHER_LINE_MESSAGE = "This worker already has a row on that day in another line.";
export const CELL_BUSY_MESSAGE = "This worker already works on that day in another roster.";
export const CELL_WORKS_THAT_DAY_MESSAGE = "This worker already works on that day.";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
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

function parts(date: string): [number, number, number] {
  const [year, month, day] = date.split("-").map(Number);

  return [year, month, day];
}

// Calendar arithmetic on YYYY-MM-DD with no time zone, through UTC so no daylight saving applies.
export function addDays(date: string, days: number): string {
  const [year, month, day] = parts(date);

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// One date for a daily request and seven for a weekly one, from the start date.
export function requestDays(startDate: string, type: "daily" | "weekly"): string[] {
  const count = type === "weekly" ? 7 : 1;

  return Array.from({ length: count }, (_, index) => addDays(startDate, index));
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

// Fixed English names, so the text does not depend on the server's locale.
export function shortDate(date: string): string {
  const [year, month, day] = parts(date);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  return `${weekday} ${day} ${MONTHS_SHORT[month - 1]}`;
}

// A roster can be changed while it is a draft and its request is still approved. A request that
// was cancelled afterwards leaves its roster on record, read-only.
export function isRosterEditable(rosterStatus: string, requestStatus: string): boolean {
  return rosterStatus === "draft" && requestStatus === "approved";
}

// "Mon 9", the header of a day in the roster grid.
export function dayLabel(date: string): string {
  return shortDate(date).split(" ").slice(0, 2).join(" ");
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

// "1 warning", "2 warnings".
export function warningsLabel(count: number): string {
  return plural(count, "warning", "warnings");
}

// The success toast of an edit, with the rule warnings the edit introduced when there are any.
export function warningsAddedMessage(message: string, warnings: number): string {
  return warnings > 0 ? `${message}. ${warningsLabel(warnings)} added` : message;
}

const LOCKED_NOTE =
  "A confirmed roster is locked: you can no longer replace workers or generate it again.";

// What remains when the roster is confirmed: shifts nobody could fill and rules an edit broke.
export function confirmDescription(unfilled: number, warnings: number): string {
  const remaining = [
    unfilled > 0 ? `${unfilled} ${unfilled === 1 ? "shift is" : "shifts are"} still unfilled` : null,
    warnings > 0 ? `${warnings} ${warnings === 1 ? "warning remains" : "warnings remain"}` : null,
  ].filter(Boolean);

  return remaining.length === 0 ? LOCKED_NOTE : `${remaining.join(" and ")}. ${LOCKED_NOTE}`;
}

export function generateAgainDescription(edits: number, conflicts: number): string {
  const lost = [
    edits > 0 ? plural(edits, "manual edit", "manual edits") : null,
    conflicts > 0 ? `the ${plural(conflicts, "conflict", "conflicts")} listed now` : null,
  ].filter(Boolean);

  return lost.length === 0
    ? "The current draft is replaced."
    : `The current draft is replaced. This discards ${lost.join(" and ")}.`;
}

export function monthName(date: string): string {
  return MONTHS_LONG[parts(date)[1] - 1];
}

// An even split of one day's headcount across the shifts. The remainder goes to the earliest shifts.
export function evenSplit(total: number, shiftIds: string[]): number[] {
  const base = Math.floor(total / shiftIds.length);
  const remainder = total % shiftIds.length;

  return shiftIds.map((_, index) => base + (index < remainder ? 1 : 0));
}

// "Any shift" for a line the roster may split, or "Shift N" for a line fixed to the shift of that
// order. It follows the line's title in the headers of the roster and the Generate screen.
export function shiftLabel(order: number | null): string {
  return order === null ? "Any shift" : `Shift ${order}`;
}

// The split of a line fixed to one shift: each day's whole headcount on that shift, 0 on the rest.
// split[day][shiftIndex] follows the order of shiftIds.
export function fixedSplit(
  required: number[],
  shiftIds: string[],
  fixedShiftId: string,
): number[][] {
  return required.map((headcount) =>
    shiftIds.map((shiftId) => (shiftId === fixedShiftId ? headcount : 0)),
  );
}

// True when a target puts headcount on a shift other than the one its line is fixed to. Lines set
// to Any shift (shiftId null) can be split any way.
export function targetsMoveFixedLine(
  lines: { lineId: string; shiftId: string | null }[],
  targets: { lineId: string; shiftId: string; headcount: number }[],
): boolean {
  const fixed = new Map(lines.map((line) => [line.lineId, line.shiftId]));

  return targets.some((target) => {
    const fixedShiftId = fixed.get(target.lineId) ?? null;

    return fixedShiftId !== null && target.headcount > 0 && target.shiftId !== fixedShiftId;
  });
}

// split[day] holds the headcount of each shift on that day. Returns the first day whose shifts do
// not add up to the request's headcount for that day.
export function targetsTotalError(
  required: number[],
  split: number[][],
): TargetsTotalError | null {
  for (let dayIndex = 0; dayIndex < required.length; dayIndex += 1) {
    const sum = (split[dayIndex] ?? []).reduce((total, count) => total + count, 0);

    if (sum !== required[dayIndex]) {
      return { dayIndex, sum, required: required[dayIndex] };
    }
  }

  return null;
}

// The Generate screen's split as the targets generateRoster takes: a target for every cell, zero
// headcounts included. splits[line][day][shiftIndex] follows the order of the three id lists.
export function splitsToTargets(
  lineIds: string[],
  days: string[],
  shiftIds: string[],
  splits: number[][][],
) {
  return lineIds.flatMap((lineId, lineIndex) =>
    days.flatMap((date, dayIndex) =>
      shiftIds.map((shiftId, shiftIndex) => ({
        lineId,
        date,
        shiftId,
        headcount: splits[lineIndex]?.[dayIndex]?.[shiftIndex] ?? 0,
      })),
    ),
  );
}

const JAKARTA_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// "3 Nov 21:17" in Jakarta time. The zone is fixed, so the server and the browser print the same
// text and the page does not mismatch on hydration.
export function formatRosterTime(iso: string): string {
  const moment = new Date(iso);
  const [, month, day] = dateInZone("Asia/Jakarta", moment).split("-").map(Number);

  return `${day} ${MONTHS_SHORT[month - 1]} ${JAKARTA_CLOCK.format(moment)}`;
}

export function targetsTotalMessage(date: string, sum: number, required: number): string {
  return `${shortDate(date)} adds up to ${sum}, but the request needs ${required}. Make each day add up to the request.`;
}

// Worker rows on a page of the grid until the viewer picks another size.
export const GRID_PAGE_SIZE = 20;

// The lines the grid shows under its filters. A line has to match every filter that is set. A line
// set to Any shift passes the shift filter, since its cells can hold any shift. Search keeps the
// workers whose name or employee ID contains the text, and drops a line left with none.
export function filterLines(lines: RosterLineView[], filters: RosterLineFilters): RosterLineView[] {
  const search = filters.search.trim().toLowerCase();

  return lines
    .filter(
      (line) =>
        (filters.departmentId === null || line.departmentId === filters.departmentId) &&
        (filters.subDepartmentId === null || line.subDepartmentId === filters.subDepartmentId) &&
        (filters.positionId === null || line.positionId === filters.positionId) &&
        (filters.shiftId === null || line.shiftId === null || line.shiftId === filters.shiftId),
    )
    .flatMap((line) => {
      if (search === "") {
        return [line];
      }

      const workers = line.workers.filter(
        (worker) =>
          worker.name.toLowerCase().includes(search) ||
          worker.employeeId.toLowerCase().includes(search),
      );

      return workers.length > 0 ? [{ ...line, workers }] : [];
    });
}

function byName(a: RosterLineOption, b: RosterLineOption): number {
  const left = a.name.toLowerCase();
  const right = b.name.toLowerCase();

  return left < right ? -1 : left > right ? 1 : 0;
}

function distinctOptions(entries: { id: string; name: string }[]): RosterLineOption[] {
  return [...new Map(entries.map((entry) => [entry.id, entry])).values()]
    .map(({ id, name }) => ({ id, name }))
    .sort(byName);
}

// What the department, sub-department, and position filters offer: the ones this roster's lines
// use, by name. The sub-departments are those of the chosen department when one is chosen.
export function lineFilterOptions(
  lines: RosterLineView[],
  departmentId: string | null,
): RosterLineOptions {
  return {
    departments: distinctOptions(
      lines.map((line) => ({ id: line.departmentId, name: line.departmentName })),
    ),
    subDepartments: distinctOptions(
      lines
        .filter((line) => departmentId === null || line.departmentId === departmentId)
        .flatMap((line) =>
          line.subDepartmentId === null || line.subDepartmentName === null
            ? []
            : [{ id: line.subDepartmentId, name: line.subDepartmentName }],
        ),
    ),
    positions: distinctOptions(lines.map((line) => ({ id: line.positionId, name: line.positionName }))),
  };
}

// One page of the grid, cut by worker rows across the lines. A line the page cuts appears on both
// pages, each with its own workers. A line with no workers takes one row, so it and its Add worker
// button are on some page. A page past the end gives the last one.
export function pageLines(lines: RosterLineView[], page: number, pageSize: number): RosterPageSlices {
  const size = Math.max(1, pageSize);
  const rowsOf = (line: RosterLineView) => Math.max(line.workers.length, 1);
  const total = lines.reduce((sum, line) => sum + rowsOf(line), 0);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * size;
  const end = start + size;
  const slices: RosterPageSlices["slices"] = [];
  let offset = 0;

  for (const line of lines) {
    const rows = rowsOf(line);
    const from = Math.max(start, offset) - offset;
    const to = Math.min(end, offset + rows) - offset;

    if (from < to) {
      slices.push({ ...line, workers: line.workers.slice(from, to), endsHere: to === rows });
    }

    offset += rows;
  }

  return { slices, page: current, pageCount };
}

// "12 workers in 3 of 5 lines" while filters hide some lines, "12 workers in 5 lines" when none.
// A worker with rows in two lines counts once, as in the roster's own summary.
export function lineSummary(shown: RosterLineView[], totalLines: number): string {
  const workers = new Set(shown.flatMap((line) => line.workers.map((worker) => worker.workerId))).size;
  const lines =
    shown.length === totalLines
      ? plural(totalLines, "line", "lines")
      : `${shown.length} of ${totalLines} lines`;

  return `${plural(workers, "worker", "workers")} in ${lines}`;
}

// Postgres reports a unique violation with code 23505. Drizzle wraps the driver's error, so the
// code can sit on the cause.
export function isUniqueViolation(error: unknown): boolean {
  const code = (value: unknown) =>
    typeof value === "object" && value !== null && "code" in value ? value.code : undefined;

  return code(error) === "23505" || code((error as { cause?: unknown } | null)?.cause) === "23505";
}

// The four resolved work rules the engine and the replacement check read.
export function toEngineRules({ values }: WorkRulesResolved): EngineRules {
  return {
    workDaysPerWeek: values.workDaysPerWeek,
    shiftExceptionDays: values.shiftExceptionDays,
    requirePositionMatch: values.requirePositionMatch,
    maxWorkingDaysPerMonth: values.maxWorkingDaysPerMonth,
  };
}
