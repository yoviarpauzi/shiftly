import type { CellChange, EvalCell, RosterWarning, ShortageRow } from "@/types/rosters";

import {
  CELL_BUSY_MESSAGE,
  CELL_DATE_MESSAGE,
  CELL_OTHER_LINE_MESSAGE,
  CELL_SHIFT_MESSAGE,
  REPLACEMENT_WORKER_MISSING_MESSAGE,
} from "./roster-rules";

// The cells after one edit: the worker's cell for that day, on any line, is dropped and the new one
// is added unless the edit clears it. Returns a new array.
export function applyCellChange(cells: EvalCell[], change: CellChange): EvalCell[] {
  const { lineId, workerId, date, to } = change;
  const kept = cells.filter((cell) => !(cell.workerId === workerId && cell.date === date));

  if (to.kind === "clear") {
    return kept;
  }

  if (to.kind === "work") {
    return [
      ...kept,
      { lineId, workerId, date, kind: "work", shiftOrder: to.shiftOrder, shiftId: to.shiftId },
    ];
  }

  return [...kept, { lineId, workerId, date, kind: to.kind, shiftOrder: null, shiftId: null }];
}

const warningKey = (warning: RosterWarning) =>
  `${warning.code}|${warning.lineId}|${warning.workerId}|${warning.date}`;

// The warnings an edit adds: those after it whose code, line, worker, and date were not warned before.
export function introducedWarnings(
  before: RosterWarning[],
  after: RosterWarning[],
): RosterWarning[] {
  const known = new Set(before.map(warningKey));

  return after.filter((warning) => !known.has(warningKey(warning)));
}

// The first reason a cell edit is impossible, not just against a rule. Rules are warned about
// instead. null when the edit can go ahead.
export function cellHardError(input: {
  date: string;
  days: string[];
  workerActive: boolean;
  shiftKnown: boolean;
  rowsThatDay: { lineId: string }[];
  targetLineId: string;
  busyElsewhere: boolean;
}): string | null {
  if (!input.days.includes(input.date)) {
    return CELL_DATE_MESSAGE;
  }

  if (!input.workerActive) {
    return REPLACEMENT_WORKER_MISSING_MESSAGE;
  }

  if (!input.shiftKnown) {
    return CELL_SHIFT_MESSAGE;
  }

  if (input.rowsThatDay.some((row) => row.lineId !== input.targetLineId)) {
    return CELL_OTHER_LINE_MESSAGE;
  }

  if (input.busyElsewhere) {
    return CELL_BUSY_MESSAGE;
  }

  return null;
}

// The stored shortages for the cells as they are now. A shortage whose shortfall did not change keeps
// the message the engine gave it, which says why nobody could be found. Sorted by date, line, shift.
export function shortageRows(input: {
  targets: { lineId: string; date: string; shiftId: string; headcount: number }[];
  cells: EvalCell[];
  previous: {
    lineId: string;
    date: string;
    shiftId: string | null;
    shortfall: number;
    message: string;
  }[];
}): ShortageRow[] {
  const key = (lineId: string, date: string, shiftId: string | null) =>
    `${lineId}|${date}|${shiftId}`;
  const assigned = new Map<string, number>();

  for (const cell of input.cells) {
    if (cell.kind === "work") {
      const cellKey = key(cell.lineId, cell.date, cell.shiftId);

      assigned.set(cellKey, (assigned.get(cellKey) ?? 0) + 1);
    }
  }

  const previous = new Map(
    input.previous.map((row) => [key(row.lineId, row.date, row.shiftId), row]),
  );
  const rows: ShortageRow[] = [];

  for (const target of input.targets) {
    const targetKey = key(target.lineId, target.date, target.shiftId);
    const shortfall = target.headcount - (assigned.get(targetKey) ?? 0);

    if (shortfall <= 0) {
      continue;
    }

    const earlier = previous.get(targetKey);

    rows.push({
      lineId: target.lineId,
      date: target.date,
      shiftId: target.shiftId,
      shortfall,
      message: earlier?.shortfall === shortfall ? earlier.message : `Short by ${shortfall}.`,
    });
  }

  return rows.sort(
    (a, b) =>
      compare(a.date, b.date) || compare(a.lineId, b.lineId) || compare(a.shiftId, b.shiftId),
  );
}

function compare(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}
