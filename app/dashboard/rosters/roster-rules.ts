import type { EngineRules, TargetsTotalError } from "@/types/rosters";

export const REQUEST_NOT_APPROVED_MESSAGE = "This request is no longer approved.";
export const ROSTER_CONFIRMED_MESSAGE = "This roster is confirmed and cannot be changed.";
export const ROSTER_CHANGED_MESSAGE = "The roster changed. Reload and try again.";
export const ROSTER_NOT_FOUND_MESSAGE = "Roster not found";
export const ROSTER_EXISTS_MESSAGE = "This request already has a roster.";

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
