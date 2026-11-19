import { addDays } from "@/app/dashboard/rosters/roster-rules";
import { isCalendarDate } from "@/validation/calendar-date";
import type { BillingMode, BillingPeriod, BillingPeriodInput } from "@/types/billings";

export const MAX_CUSTOM_DAYS = 366;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function utcMs(date: string): number {
  const [year, month, day] = date.split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}

// Both ends count, so one day is 1.
export function inclusiveDays(from: string, to: string): number {
  return Math.round((utcMs(to) - utcMs(from)) / DAY_MS) + 1;
}

// Null when the input is not a valid period. Dates are plain text, with no zone conversion.
export function periodFor(input: BillingPeriodInput): BillingPeriod | null {
  if (input.mode === "monthly") {
    if (!MONTH_PATTERN.test(input.month)) return null;

    const [year, month] = input.month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return { from: `${input.month}-01`, to: `${input.month}-${String(lastDay).padStart(2, "0")}` };
  }

  if (input.mode === "weekly") {
    if (!isCalendarDate(input.date)) return null;

    const sinceMonday = (new Date(utcMs(input.date)).getUTCDay() + 6) % 7;
    const from = addDays(input.date, -sinceMonday);

    return { from, to: addDays(from, 6) };
  }

  if (!isCalendarDate(input.from) || !isCalendarDate(input.to)) return null;
  if (input.from > input.to) return null;
  if (inclusiveDays(input.from, input.to) > MAX_CUSTOM_DAYS) return null;

  return { from: input.from, to: input.to };
}

// The period a mode starts with: the month of the day, the week of the day, or that one day.
export function defaultPeriodInput(mode: BillingMode, today: string): BillingPeriodInput {
  if (mode === "monthly") return { mode, month: today.slice(0, 7) };
  if (mode === "weekly") return { mode, date: today };

  return { mode, from: today, to: today };
}

// The form value that shows a stored billing period again, for the Edit period dialog.
export function periodInputFor(mode: BillingMode, period: BillingPeriod): BillingPeriodInput {
  if (mode === "monthly") return { mode, month: period.from.slice(0, 7) };
  if (mode === "weekly") return { mode, date: period.from };

  return { mode, from: period.from, to: period.to };
}
