import type { ReplacementInput, ReplacementResult, Reason } from "@/types/rosters";

import {
  contractEnded,
  monthlyMessage,
  monthlyOverrunEvents,
  shiftMoveEvents,
  shiftMoveMessage,
} from "./roster-constraints";
import { shortDate } from "./roster-rules";

// Replays a candidate on the replaced worker's whole row against the same rule helpers the engine
// uses, and returns every reason it breaks a rule, in a fixed order: already in the roster, the
// position, the contract, another roster, a shift move, and the monthly limit. The weekly limit is
// not checked: the candidate takes the same row, and the engine already kept that row within it.
function replacementReasons(input: ReplacementInput): Reason[] {
  const { row, candidate, position, rules, history } = input;
  const reasons: Reason[] = [];
  const workDays = row.filter((day) => day.kind === "work");

  if (input.alreadyInRoster) {
    reasons.push({ hard: true, text: "Already in this roster." });
  }

  if (rules.requirePositionMatch && !candidate.positionIds.includes(position.id)) {
    reasons.push({ hard: false, text: `Does not have the position ${position.name}.` });
  }

  if (workDays.some((day) => contractEnded(candidate, day.date))) {
    reasons.push({ hard: false, text: `Contract ends ${candidate.endContract}.` });
  }

  const other = new Set(input.otherRosterWorkDates);

  for (const day of workDays) {
    if (other.has(day.date)) {
      reasons.push({ hard: true, text: `Assigned to another roster on ${shortDate(day.date)}.` });
    }
  }

  const walked = workDays.map((day) => ({ date: day.date, shiftOrder: day.shiftOrder }));

  for (const event of shiftMoveEvents(
    walked,
    history,
    row[0]?.date ?? null,
    rules.shiftExceptionDays,
  )) {
    reasons.push({ hard: false, text: shiftMoveMessage(event, rules.shiftExceptionDays) });
  }

  for (const event of monthlyOverrunEvents(walked, history, rules.maxWorkingDaysPerMonth)) {
    reasons.push({ hard: false, text: monthlyMessage(event, rules.maxWorkingDaysPerMonth) });
  }

  return reasons;
}

// The same reasons split in two, each list keeping the fixed order.
export function checkReplacementDetailed(input: ReplacementInput): {
  hard: string[];
  warnings: string[];
} {
  const reasons = replacementReasons(input);

  return {
    hard: reasons.filter((reason) => reason.hard).map((reason) => reason.text),
    warnings: reasons.filter((reason) => !reason.hard).map((reason) => reason.text),
  };
}

// Every reason, hard or not, in the fixed order.
export function checkReplacement(input: ReplacementInput): ReplacementResult {
  const reasons = replacementReasons(input).map((reason) => reason.text);

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}
