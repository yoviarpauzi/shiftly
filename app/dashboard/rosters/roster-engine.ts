import type {
  EngineAssignment,
  EngineConflict,
  EngineWorker,
  RosterEngineInput,
  RosterEngineOutput,
} from "@/types/rosters";

import { effectiveWorkDays } from "@/app/dashboard/settings/settings-rules";

import {
  type RejectionReason,
  contractEnded,
  monthlyLimitReached,
  shiftMoveBlocked,
  shortageMessage,
} from "./roster-constraints";
import { placementTier } from "./roster-placement";
import { addDays, monthKey } from "./roster-rules";

type WorkerState = {
  workDays: number;
  assignedDates: Set<string>;
  firstWorkLineId: string | null;
  lastWorkDate: string | null;
  lastOrder: number | null;
  consecutive: number;
  months: Map<string, number>;
};

// Plain code-unit comparison, so the order never depends on the server's locale.
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function byEmployee(a: EngineWorker, b: EngineWorker): number {
  return compare(a.employeeId.toLowerCase(), b.employeeId.toLowerCase()) || compare(a.id, b.id);
}

// Engine v0: one greedy, deterministic pass. Days in date order, lines by id, shifts by order. For
// each (day, line, shift) it takes the eligible workers with the fewest work days so far, then the
// lowest employee ID. With the Keep previous placement rule on, a worker whose last department
// fits the line comes first among workers with the same number of work days, and a worker who
// belongs to another line of the request comes last of them. A shift it cannot fill becomes a
// conflict that names why the others were left out. It finds a valid roster, not the best one. The arrays of the input are copied and sorted
// first, so the order they arrive in never changes the result.
export function generateRoster(input: RosterEngineInput): RosterEngineOutput {
  const days = [...input.days].sort(compare);
  const lines = [...input.lines].sort((a, b) => compare(a.id, b.id));
  const shifts = [...input.shifts].sort((a, b) => a.order - b.order);
  const workers = [...input.workers].sort(byEmployee);
  const { rules } = input;

  const shiftOrder = new Map(shifts.map((shift) => [shift.id, shift.order]));
  const employeeOf = new Map(workers.map((worker) => [worker.id, worker.employeeId.toLowerCase()]));

  const headcounts = new Map<string, number>();
  for (const target of input.targets) {
    const key = `${target.date}|${target.lineId}|${target.shiftId}`;
    headcounts.set(key, (headcounts.get(key) ?? 0) + target.headcount);
  }

  const placements = new Map(input.history.map((entry) => [entry.workerId, entry.lastPlacement]));
  const requestDepartments = new Set(lines.map((line) => line.departmentId));

  const states = new Map<string, WorkerState>();
  const dayBeforeFirst = days.length > 0 ? addDays(days[0], -1) : null;

  for (const worker of workers) {
    const history = input.history.find((entry) => entry.workerId === worker.id);
    // The history only counts as a chain when it ends the day before the roster starts.
    const chained = history?.lastWorkDate != null && history.lastWorkDate === dayBeforeFirst;

    states.set(worker.id, {
      workDays: 0,
      assignedDates: new Set(),
      firstWorkLineId: null,
      lastWorkDate: chained ? history.lastWorkDate : null,
      lastOrder: chained ? history.lastShiftOrder : null,
      consecutive: chained ? history.consecutiveWorkDays : 0,
      months: new Map(Object.entries(history?.monthWorkDays ?? {})),
    });
  }

  function rejection(
    worker: EngineWorker,
    state: WorkerState,
    positionId: string,
    date: string,
    order: number,
  ): RejectionReason | null {
    if (rules.requirePositionMatch && !worker.positionIds.includes(positionId)) return "position";
    if (contractEnded(worker, date)) return "contract";
    if (state.assignedDates.has(date)) return "assigned";
    if (state.workDays >= effectiveWorkDays(worker.workDaysPerWeek, rules.workDaysPerWeek)) {
      return "weekly";
    }

    const chained = state.lastWorkDate === addDays(date, -1);
    const previousOrder = chained ? state.lastOrder : null;
    const consecutive = chained ? state.consecutive : 0;

    if (shiftMoveBlocked(previousOrder, order, consecutive, rules.shiftExceptionDays)) {
      return "shiftMove";
    }

    if (monthlyLimitReached(state.months.get(monthKey(date)) ?? 0, rules.maxWorkingDaysPerMonth)) {
      return "monthly";
    }

    return null;
  }

  const assignments: EngineAssignment[] = [];
  const conflicts: EngineConflict[] = [];

  for (const date of days) {
    for (const line of lines) {
      for (const shift of shifts) {
        const headcount = headcounts.get(`${date}|${line.id}|${shift.id}`) ?? 0;

        if (headcount <= 0) continue;

        const candidates: EngineWorker[] = [];
        const rejections: Partial<Record<RejectionReason, number>> = {};

        for (const worker of workers) {
          const reason = rejection(worker, states.get(worker.id)!, line.positionId, date, shift.order);

          if (reason === null) {
            candidates.push(worker);
          } else {
            rejections[reason] = (rejections[reason] ?? 0) + 1;
          }
        }

        // With the rule on, a worker whose last placement fits the line comes first among workers with
        // the same number of work days. It only reorders workers who passed every rejection above, so
        // no limit is relaxed, and the fewest work days still comes first, so the shifts rotate. A
        // worker whose last department is another line's in this request comes last of those: lines
        // are filled one after the other, and an earlier line borrowing that worker would leave their
        // own line short.
        const tierOf = (candidate: EngineWorker): number => {
          if (!rules.keepPreviousPlacement) return 0;

          const previous = placements.get(candidate.id) ?? null;
          const tier = placementTier(previous, line);

          return tier === 0 && previous && requestDepartments.has(previous.departmentId) ? -1 : tier;
        };

        candidates.sort(
          (a, b) =>
            states.get(a.id)!.workDays - states.get(b.id)!.workDays ||
            tierOf(b) - tierOf(a) ||
            byEmployee(a, b),
        );

        const chosen = candidates.slice(0, headcount);

        for (const worker of chosen) {
          const state = states.get(worker.id)!;
          const chained = state.lastWorkDate === addDays(date, -1);

          state.consecutive = (chained ? state.consecutive : 0) + 1;
          state.lastWorkDate = date;
          state.lastOrder = shift.order;
          state.workDays += 1;
          state.assignedDates.add(date);
          state.firstWorkLineId ??= line.id;
          state.months.set(monthKey(date), (state.months.get(monthKey(date)) ?? 0) + 1);

          assignments.push({
            lineId: line.id,
            workerId: worker.id,
            date,
            kind: "work",
            shiftId: shift.id,
          });
        }

        if (chosen.length < headcount) {
          const shortfall = headcount - chosen.length;

          conflicts.push({
            lineId: line.id,
            date,
            shiftId: shift.id,
            code: "shortage",
            shortfall,
            message: shortageMessage(shortfall, rejections),
          });
        }
      }
    }
  }

  // A worker who works at all gets an off row for each other day of the roster that is still inside
  // the contract, on the line of the worker's first work day.
  for (const worker of workers) {
    const state = states.get(worker.id)!;

    if (state.workDays === 0 || state.firstWorkLineId === null) continue;

    for (const date of days) {
      if (!state.assignedDates.has(date) && !contractEnded(worker, date)) {
        assignments.push({
          lineId: state.firstWorkLineId,
          workerId: worker.id,
          date,
          kind: "off",
          shiftId: null,
        });
      }
    }
  }

  const orderOf = (shiftId: string | null) =>
    shiftId === null ? Number.MAX_SAFE_INTEGER : (shiftOrder.get(shiftId) ?? Number.MAX_SAFE_INTEGER);

  assignments.sort(
    (a, b) =>
      compare(a.date, b.date) ||
      compare(a.lineId, b.lineId) ||
      orderOf(a.shiftId) - orderOf(b.shiftId) ||
      compare(employeeOf.get(a.workerId) ?? "", employeeOf.get(b.workerId) ?? "") ||
      compare(a.workerId, b.workerId),
  );
  conflicts.sort(
    (a, b) =>
      compare(a.date, b.date) || compare(a.lineId, b.lineId) || orderOf(a.shiftId) - orderOf(b.shiftId),
  );

  return { assignments, conflicts };
}
