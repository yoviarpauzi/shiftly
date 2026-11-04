import type { EvalCell, EvaluateInput, RosterWarning, WarningCode } from "@/types/rosters";

import { effectiveWorkDays } from "@/app/dashboard/settings/settings-rules";

import {
  contractEnded,
  monthlyMessage,
  monthlyOverrunEvents,
  shiftMoveEvents,
  shiftMoveMessage,
} from "./roster-constraints";
import { shortDate } from "./roster-rules";

// Checks every cell of an edited roster against the rules and returns what it breaks, as warnings.
// Nothing is refused. The shift-move and monthly walks, and their message text, come from
// roster-constraints, shared with checkReplacement. Sorted by date, line, code, then worker, with a
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
    // The worker's own limit wins over the rule, as in the engine. A worker the input does not list
    // follows the rule.
    const weeklyLimit = effectiveWorkDays(worker?.workDaysPerWeek ?? null, rules.workDaysPerWeek);

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

      if (index === weeklyLimit) {
        warn("weekly", cell, `Would exceed ${weeklyLimit} working days this week.`);
      }
    });

    for (const event of shiftMoveEvents(cells, history, firstDay, rules.shiftExceptionDays)) {
      warn("shiftMove", cells[event.index], shiftMoveMessage(event, rules.shiftExceptionDays));
    }

    for (const event of monthlyOverrunEvents(cells, history, rules.maxWorkingDaysPerMonth)) {
      warn("monthly", cells[event.index], monthlyMessage(event, rules.maxWorkingDaysPerMonth));
    }
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
