import { dateInZone } from "@/lib/indonesia-date";
import type { EngineRules, TargetsTotalError } from "@/types/rosters";

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

// "Mon 9", the header of a day in the roster grid.
export function dayLabel(date: string): string {
  return shortDate(date).split(" ").slice(0, 2).join(" ");
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const LOCKED_NOTE =
  "A confirmed roster is locked: you can no longer replace workers or generate it again.";

export function confirmDescription(unfilled: number): string {
  return unfilled === 0
    ? LOCKED_NOTE
    : `${unfilled} ${unfilled === 1 ? "shift is" : "shifts are"} still unfilled. ${LOCKED_NOTE}`;
}

export function generateAgainDescription(edits: number, conflicts: number): string {
  const lost = [
    edits > 0 ? plural(edits, "manual replacement", "manual replacements") : null,
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

// Postgres reports a unique violation with code 23505. Drizzle wraps the driver's error, so the
// code can sit on the cause.
export function isUniqueViolation(error: unknown): boolean {
  const code = (value: unknown) =>
    typeof value === "object" && value !== null && "code" in value ? value.code : undefined;

  return code(error) === "23505" || code((error as { cause?: unknown } | null)?.cause) === "23505";
}

// Until the Settings menu exists, every location gets the built-in defaults. When it does, the body
// becomes a call to resolveWorkRules for this location.
export function rulesForLocation(locationId: string): EngineRules {
  void locationId;

  return {
    workDaysPerWeek: 5,
    shiftExceptionDays: 7,
    requirePositionMatch: true,
    maxWorkingDaysPerMonth: 26,
  };
}
