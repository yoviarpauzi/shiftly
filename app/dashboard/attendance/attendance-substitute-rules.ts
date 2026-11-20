import type { EngineHistory, EngineRules } from "@/types/rosters";

import { contractEnded } from "../rosters/roster-constraints";
import { checkReplacementDetailed } from "../rosters/roster-replacement";

export const NEEDS_ABSENT_MESSAGE = "Mark the worker Absent and save first.";
export const SUBSTITUTE_COVERS_MESSAGE = "This worker already covers someone else that day.";

export const SUBSTITUTE_MESSAGES = {
  deleted: "This worker is no longer active.",
  // The chosen id is not an active worker of the location: unknown, removed, or elsewhere.
  notAvailable: "This worker is not available.",
  otherLocation: "This worker belongs to another location.",
  sameWorker: "The absent worker cannot cover themself.",
  contractEnded: (endContract: string) => `Contract ended ${endContract}.`,
  alreadyWorking: "Already assigned to work on this day.",
  alreadyCovering: "Already covers another worker on this day.",
};

export type SubstituteCheckInput = {
  date: string;
  absentWorkerId: string;
  absentShiftOrder: number;
  position: { id: string; name: string };
  rules: EngineRules;
  candidate: {
    id: string;
    endContract: string;
    positionIds: string[];
    deleted: boolean;
    locationId: string;
  };
  locationId: string;
  // The candidate works a shift on this date in a confirmed roster.
  workDatesToday: boolean;
  // The candidate already covers another absent worker on this date.
  alreadyCovering: boolean;
  history: EngineHistory;
};

// Whether a worker may cover an absent one for a day. hard blocks the choice. warnings are the
// roster rules (position, shift move, monthly limit) the choice would break: the admin may go on.
// Contract is a hard block here, so the roster check runs with a contract that never ends.
export function checkSubstitute(input: SubstituteCheckInput): { hard: string[]; warnings: string[] } {
  const { candidate } = input;
  const hard: string[] = [];

  if (candidate.deleted) hard.push(SUBSTITUTE_MESSAGES.deleted);
  if (candidate.locationId !== input.locationId) hard.push(SUBSTITUTE_MESSAGES.otherLocation);
  if (candidate.id === input.absentWorkerId) hard.push(SUBSTITUTE_MESSAGES.sameWorker);
  if (contractEnded(candidate, input.date)) {
    hard.push(SUBSTITUTE_MESSAGES.contractEnded(candidate.endContract));
  }
  if (input.workDatesToday) hard.push(SUBSTITUTE_MESSAGES.alreadyWorking);
  if (input.alreadyCovering) hard.push(SUBSTITUTE_MESSAGES.alreadyCovering);

  const { warnings } = checkReplacementDetailed({
    row: [{ date: input.date, kind: "work", shiftOrder: input.absentShiftOrder }],
    candidate: {
      id: candidate.id,
      endContract: "9999-12-31",
      positionIds: candidate.positionIds,
    },
    position: input.position,
    alreadyInRoster: false,
    otherRosterWorkDates: [],
    history: input.history,
    rules: input.rules,
  });

  return { hard, warnings };
}
