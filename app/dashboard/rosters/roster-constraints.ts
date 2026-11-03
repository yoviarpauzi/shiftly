// The rule helpers the engine and the replacement check share, so the two cannot disagree. Pure,
// with no server-only, so tests import them directly.

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
