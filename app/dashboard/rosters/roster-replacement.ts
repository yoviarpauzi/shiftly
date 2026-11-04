import type { ReplacementInput, ReplacementResult } from "@/types/rosters";

import { contractEnded, monthlyLimitReached, shiftMoveBlocked } from "./roster-constraints";
import { addDays, monthKey, monthName, shortDate } from "./roster-rules";

// Replays a candidate on the replaced worker's whole row against the same rule helpers the engine
// uses, and returns every reason it breaks a rule, in a fixed order: already in the roster, the
// position, the contract, another roster, a shift move, and the monthly limit. The weekly limit is
// not checked: the candidate takes the same row, and the engine already kept that row within it.
export function checkReplacement(input: ReplacementInput): ReplacementResult {
  const { row, candidate, position, rules, history } = input;
  const reasons: string[] = [];
  const workDays = row.filter((day) => day.kind === "work");

  if (input.alreadyInRoster) {
    reasons.push("Already in this roster.");
  }

  if (rules.requirePositionMatch && !candidate.positionIds.includes(position.id)) {
    reasons.push(`Does not have the position ${position.name}.`);
  }

  if (workDays.some((day) => contractEnded(candidate, day.date))) {
    reasons.push(`Contract ends ${candidate.endContract}.`);
  }

  const other = new Set(input.otherRosterWorkDates);

  for (const day of workDays) {
    if (other.has(day.date)) {
      reasons.push(`Assigned to another roster on ${shortDate(day.date)}.`);
    }
  }

  // The history only counts as a chain when it ends the day before the row starts.
  const first = row[0]?.date ?? null;
  const chained = first !== null && history.lastWorkDate === addDays(first, -1);
  let lastDate = chained ? history.lastWorkDate : null;
  let lastOrder = chained ? history.lastShiftOrder : null;
  let consecutive = chained ? history.consecutiveWorkDays : 0;

  for (const day of workDays) {
    const order = day.shiftOrder ?? 0;
    const inChain = lastDate === addDays(day.date, -1);
    const previousOrder = inChain ? lastOrder : null;
    const run = inChain ? consecutive : 0;

    if (shiftMoveBlocked(previousOrder, order, run, rules.shiftExceptionDays)) {
      reasons.push(
        `Moves from shift ${previousOrder} to shift ${order} on ${shortDate(day.date)}, before ${rules.shiftExceptionDays} working days.`,
      );
    }

    consecutive = run + 1;
    lastDate = day.date;
    lastOrder = order;
  }

  const counts = new Map<string, number>();
  const exceeded = new Set<string>();

  for (const day of workDays) {
    const month = monthKey(day.date);
    const before = counts.get(month) ?? history.monthWorkDays[month] ?? 0;

    if (monthlyLimitReached(before, rules.maxWorkingDaysPerMonth) && !exceeded.has(month)) {
      exceeded.add(month);
      reasons.push(
        `Would exceed ${rules.maxWorkingDaysPerMonth} working days in ${monthName(day.date)}.`,
      );
    }

    counts.set(month, before + 1);
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}
