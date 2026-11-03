import type { EngineHistory, MonthlyOverrunEvent, ShiftMoveEvent, WalkCell } from "@/types/rosters";

import { addDays, monthKey, monthName, shortDate } from "./roster-rules";

// The rule helpers the engine, the replacement check and the roster evaluation share. Pure, with no
// server-only, so tests import them directly.

// The six reasons a worker can be left out, in the priority order the engine counts them: the first
// rule that rejects a worker is the one reported. The order of the keys is the priority.
export const REJECTION_PHRASES = {
  position: "without the position",
  contract: "with a contract ended",
  assigned: "already assigned that day",
  weekly: "at the weekly limit",
  shiftMove: "blocked from moving to a lower shift",
  monthly: "at the monthly limit",
} as const;

export type RejectionReason = keyof typeof REJECTION_PHRASES;

// endContract is the last day of the contract, so the day after it is the first day without one.
export function contractEnded(worker: { endContract: string }, date: string): boolean {
  return date > worker.endContract;
}

// A worker may not move to a lower shift number, unless the worker has already worked the exception
// number of days in a row. With no previous shift there is nothing to move from.
export function shiftMoveBlocked(
  previousOrder: number | null,
  nextOrder: number,
  consecutiveWorkDays: number,
  shiftExceptionDays: number,
): boolean {
  return (
    previousOrder !== null && nextOrder < previousOrder && consecutiveWorkDays < shiftExceptionDays
  );
}

export function monthlyLimitReached(
  workDaysInMonth: number,
  maxWorkingDaysPerMonth: number,
): boolean {
  return workDaysInMonth >= maxWorkingDaysPerMonth;
}

// Walks one worker's work cells, in date order, and returns each move to a lower shift that
// shiftMoveBlocked refuses. The history only counts as a chain when it ends the day before
// firstDay, and a run is broken by any day without a work cell. index is the cell's position.
export function shiftMoveEvents(
  cells: WalkCell[],
  history: EngineHistory | undefined,
  firstDay: string | null,
  shiftExceptionDays: number,
): ShiftMoveEvent[] {
  const events: ShiftMoveEvent[] = [];
  const chained =
    history !== undefined && firstDay !== null && history.lastWorkDate === addDays(firstDay, -1);
  let lastDate = chained ? history.lastWorkDate : null;
  let lastOrder = chained ? history.lastShiftOrder : null;
  let consecutive = chained ? history.consecutiveWorkDays : 0;

  cells.forEach((cell, index) => {
    const order = cell.shiftOrder ?? 0;
    const inChain = lastDate === addDays(cell.date, -1);
    const previousOrder = inChain ? lastOrder : null;
    const run = inChain ? consecutive : 0;

    if (previousOrder !== null && shiftMoveBlocked(previousOrder, order, run, shiftExceptionDays)) {
      events.push({ index, date: cell.date, previousOrder, order, run });
    }

    consecutive = run + 1;
    lastDate = cell.date;
    lastOrder = order;
  });

  return events;
}

export function shiftMoveMessage(event: ShiftMoveEvent, shiftExceptionDays: number): string {
  return `Moves from shift ${event.previousOrder} to shift ${event.order} on ${shortDate(event.date)}, before ${shiftExceptionDays} working days.`;
}

// Walks one worker's work cells, in date order, and returns the first cell that takes each month
// past the limit. A month starts from the history's count for it.
export function monthlyOverrunEvents(
  cells: WalkCell[],
  history: EngineHistory | undefined,
  maxWorkingDaysPerMonth: number,
): MonthlyOverrunEvent[] {
  const events: MonthlyOverrunEvent[] = [];
  const counts = new Map<string, number>();
  const exceeded = new Set<string>();

  cells.forEach((cell, index) => {
    const month = monthKey(cell.date);
    const before = counts.get(month) ?? history?.monthWorkDays[month] ?? 0;

    if (monthlyLimitReached(before, maxWorkingDaysPerMonth) && !exceeded.has(month)) {
      exceeded.add(month);
      events.push({ index, date: cell.date, month });
    }

    counts.set(month, before + 1);
  });

  return events;
}

export function monthlyMessage(event: MonthlyOverrunEvent, maxWorkingDaysPerMonth: number): string {
  return `Would exceed ${maxWorkingDaysPerMonth} working days in ${monthName(event.date)}.`;
}

// "Short by 2. 3 already assigned that day, 1 at the monthly limit." Only reasons that happened
// are listed, in priority order, whatever the order of the keys in the argument.
export function shortageMessage(
  shortfall: number,
  rejections: Partial<Record<RejectionReason, number>>,
): string {
  const parts = (Object.keys(REJECTION_PHRASES) as RejectionReason[])
    .filter((reason) => (rejections[reason] ?? 0) > 0)
    .map((reason) => `${rejections[reason]} ${REJECTION_PHRASES[reason]}`);

  return parts.length === 0
    ? `Short by ${shortfall}. No worker is available for this line.`
    : `Short by ${shortfall}. ${parts.join(", ")}.`;
}
