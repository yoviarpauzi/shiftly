import type { EvalCell, EvaluateInput, RosterWarning, WarningCode } from "@/types/rosters";

import { contractEnded, monthlyLimitReached, shiftMoveBlocked } from "./roster-constraints";
import { addDays, monthKey, monthName, shortDate } from "./roster-rules";

// Checks every cell of an edited roster against the rules and returns what it breaks, as warnings.
// Nothing is refused: the shift-move and monthly logic is the same chain and counting that
// checkReplacement uses, so the two cannot disagree. Sorted by date, line, code, then worker, with a
// warning about a cell group (no worker) after the worker warnings of the same code.
export function evaluateRoster(input: EvaluateInput): RosterWarning[] {
  const { rules } = input;
  const warnings: RosterWarning[] = [];
  const firstDay = input.days[0] ?? null;
  const lines = new Map(input.lines.map((line) => [line.id, line]));
  const workers = new Map(input.workers.map((worker) => [worker.id, worker]));
  const histories = new Map(input.history.map((history) => [history.workerId, history]));

  const workCells = input.cells.filter((cell) => cell.kind === "work");
  const byWorker = new Map<string, EvalCell[]>();

  for (const cell of workCells) {
    const cells = byWorker.get(cell.workerId) ?? [];

    cells.push(cell);
    byWorker.set(cell.workerId, cells);
  }

  const warn = (code: WarningCode, cell: EvalCell, message: string): void => {
    warnings.push({
      code,
      lineId: cell.lineId,
      workerId: cell.workerId,
      date: cell.date,
      shiftOrder: cell.shiftOrder,
      message,
    });
  };

  for (const [workerId, unsorted] of byWorker) {
    const cells = [...unsorted].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const worker = workers.get(workerId);
    const history = histories.get(workerId);
    const positioned = new Set<string>();
    let contractWarned = false;

    // The history only counts as a chain when it ends the day before the roster starts.
    const chained =
      history !== undefined && firstDay !== null && history.lastWorkDate === addDays(firstDay, -1);
    let lastDate = chained ? history.lastWorkDate : null;
    let lastOrder = chained ? history.lastShiftOrder : null;
    let consecutive = chained ? history.consecutiveWorkDays : 0;

    const monthCounts = new Map<string, number>();
    const exceeded = new Set<string>();

    cells.forEach((cell, index) => {
      const line = lines.get(cell.lineId);

      if (
        worker !== undefined &&
        line !== undefined &&
        rules.requirePositionMatch &&
        !worker.positionIds.includes(line.positionId) &&
        !positioned.has(cell.lineId)
      ) {
        positioned.add(cell.lineId);
        warn("position", cell, `Does not have the position ${line.positionName}.`);
      }

      if (worker !== undefined && !contractWarned && contractEnded(worker, cell.date)) {
        contractWarned = true;
        warn("contract", cell, `Contract ends ${worker.endContract}.`);
      }

      if (index === rules.workDaysPerWeek) {
        warn("weekly", cell, `Would exceed ${rules.workDaysPerWeek} working days this week.`);
      }

      const order = cell.shiftOrder ?? 0;
      const inChain = lastDate === addDays(cell.date, -1);
      const previousOrder = inChain ? lastOrder : null;
      const runLength = inChain ? consecutive : 0;

      if (shiftMoveBlocked(previousOrder, order, runLength, rules.shiftExceptionDays)) {
        warn(
          "shiftMove",
          cell,
          `Moves from shift ${previousOrder} to shift ${order} on ${shortDate(cell.date)}, before ${rules.shiftExceptionDays} working days.`,
        );
      }

      consecutive = runLength + 1;
      lastDate = cell.date;
      lastOrder = order;

      const month = monthKey(cell.date);
      const before = monthCounts.get(month) ?? history?.monthWorkDays[month] ?? 0;

      if (monthlyLimitReached(before, rules.maxWorkingDaysPerMonth) && !exceeded.has(month)) {
        exceeded.add(month);
        warn(
          "monthly",
          cell,
          `Would exceed ${rules.maxWorkingDaysPerMonth} working days in ${monthName(cell.date)}.`,
        );
      }

      monthCounts.set(month, before + 1);
    });
  }

  const assigned = new Map<string, number>();

  for (const cell of workCells) {
    const key = `${cell.lineId}|${cell.date}|${cell.shiftOrder ?? 0}`;

    assigned.set(key, (assigned.get(key) ?? 0) + 1);
  }

  for (const target of input.targets) {
    const count = assigned.get(`${target.lineId}|${target.date}|${target.shiftOrder}`) ?? 0;

    if (count > target.headcount) {
      warnings.push({
        code: "over",
        lineId: target.lineId,
        workerId: null,
        date: target.date,
        shiftOrder: target.shiftOrder,
        message: `${shortDate(target.date)} · Shift ${target.shiftOrder}: ${count} assigned, ${target.headcount} needed.`,
      });
    }
  }

  return warnings.sort(
    (a, b) =>
      compare(a.date, b.date) ||
      compare(a.lineId, b.lineId) ||
      compare(a.code, b.code) ||
      compare(a.workerId, b.workerId),
  );
}

// Strings in order, with null after every string.
function compare(a: string | null, b: string | null): number {
  if (a === b) {
    return 0;
  }

  if (a === null) {
    return 1;
  }

  if (b === null) {
    return -1;
  }

  return a < b ? -1 : 1;
}
