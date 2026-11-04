"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import type { ZodError } from "zod";
import { rosterRequest } from "@/database/schema/request-schema";
import {
  roster,
  rosterAssignment,
  rosterCellEdit,
  rosterConflict,
  rosterEdit,
  rosterShiftTarget,
} from "@/database/schema/roster-schema";
import { db } from "@/lib/db";
import type { RequestAccess, Transaction } from "@/types/requests";
import type {
  CellCandidate,
  CellChange,
  CellContext,
  CellContextResult,
  CellTarget,
  EvalCell,
  ReplacementCandidate,
  RosterActionResult,
} from "@/types/rosters";
import {
  cellCandidatesSchema,
  confirmRosterSchema,
  editCellSchema,
  generateRosterSchema,
  previewCellSchema,
  replaceWorkerSchema,
  swapCellSchema,
  type CellCandidatesInput,
  type ConfirmRosterInput,
  type EditCellInput,
  type GenerateRosterInput,
  type PreviewCellInput,
  type ReplaceWorkerInput,
  type SwapCellInput,
} from "@/validation/rosters";
import { parseRequestId } from "@/validation/request-id";
import { canAccessRosterLocation } from "./roster-access";
import { generateRoster as runEngine } from "./roster-engine";
import { requireRosterUser } from "./roster-guard";
import { applyCellChange, cellHardError, introducedWarnings, shortageRows } from "./roster-cell-edit";
import { evaluateRoster } from "./roster-evaluation";
import { checkReplacementDetailed } from "./roster-replacement";
import {
  CELL_DATE_MESSAGE,
  CELL_WORKS_THAT_DAY_MESSAGE,
  isUniqueViolation,
  REPLACEMENT_WORKER_MISSING_MESSAGE,
  REQUEST_NOT_APPROVED_MESSAGE,
  ROSTER_CHANGED_MESSAGE,
  ROSTER_CONFIRMED_MESSAGE,
  ROSTER_EXISTS_MESSAGE,
  ROSTER_LINE_MISSING_MESSAGE,
  ROSTER_NOT_FOUND_MESSAGE,
  ROSTER_WORKER_MISSING_MESSAGE,
  TARGETS_MISMATCH_MESSAGE,
  targetsMoveFixedLine,
  targetsTotalError,
  targetsTotalMessage,
} from "./roster-rules";
import {
  loadCellContext,
  loadEngineInput,
  loadLocationWorkers,
  loadReplacementContext,
  loadRequestLines,
  loadRosterWorkerIds,
  replacementCandidates,
} from "./rosters";

const ROSTERS_PATH = "/dashboard/rosters";

function revalidateRoster(id: string) {
  revalidatePath(ROSTERS_PATH);
  revalidatePath(`${ROSTERS_PATH}/${id}`);
}

// Invalid input from a client that skipped the form. The first message is the form error, and each
// issue is keyed by its path.
function invalidInput(error: ZodError): RosterActionResult {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".");

    if (!(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }

  return { ok: false, formError: error.issues[0]?.message ?? "Invalid input", fieldErrors };
}

// One writer per location at a time. Two rosters of the same location read each other's work days
// to keep a worker from being booked twice, and neither can see the other's uncommitted rows, so
// the writes take turns. Always taken after the request lock and before the roster lock.
async function lockLocation(tx: Transaction, locationId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${locationId}))`);
}

// Locks the request row, then the roster row, in the order generate takes them, so a concurrent
// generate, edit, replace, or confirm waits. serialize also takes the location lock between the two,
// for a write that checks other rosters. A roster outside the actor's scope is the same as a
// missing one.
async function lockRoster(
  tx: Transaction,
  access: RequestAccess,
  rosterId: string,
  { serialize }: { serialize: boolean },
) {
  const [found] = await tx
    .select({ requestId: roster.requestId })
    .from(roster)
    .where(eq(roster.id, rosterId));

  if (!found) {
    return null;
  }

  const [request] = await tx
    .select({
      status: rosterRequest.status,
      siteId: rosterRequest.siteId,
      locationId: rosterRequest.locationId,
    })
    .from(rosterRequest)
    .where(eq(rosterRequest.id, found.requestId))
    .for("update");

  if (!request || !canAccessRosterLocation(access, { id: request.locationId, siteId: request.siteId })) {
    return null;
  }

  if (serialize) {
    await lockLocation(tx, request.locationId);
  }

  const [row] = await tx
    .select({ id: roster.id, status: roster.status, updatedAt: roster.updatedAt })
    .from(roster)
    .where(eq(roster.id, rosterId))
    .for("update");

  return row ? { ...row, requestStatus: request.status } : null;
}

// A roster is read-only once its request is no longer approved, or once it is confirmed.
function statusError(row: { status: string; requestStatus: string }): string | null {
  if (row.requestStatus !== "approved") return REQUEST_NOT_APPROVED_MESSAGE;
  if (row.status === "confirmed") return ROSTER_CONFIRMED_MESSAGE;

  return null;
}

// A roster that is read-only refuses every edit, and an edit made on an old version would overwrite
// a newer one.
function editError(
  row: { status: string; updatedAt: Date; requestStatus: string },
  version: string,
): string | null {
  const refused = statusError(row);

  if (refused) return refused;
  if (row.updatedAt.toISOString() !== version) return ROSTER_CHANGED_MESSAGE;

  return null;
}

export async function generateRoster(input: GenerateRosterInput): Promise<RosterActionResult> {
  const { user, access } = await requireRosterUser();
  const parsed = generateRosterSchema.safeParse(input);

  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const data = parsed.data;

  try {
    const result = await db.transaction(async (tx): Promise<RosterActionResult> => {
      // The request lock makes two simultaneous generates for it take turns.
      const [request] = await tx
        .select({
          id: rosterRequest.id,
          status: rosterRequest.status,
          siteId: rosterRequest.siteId,
          locationId: rosterRequest.locationId,
        })
        .from(rosterRequest)
        .where(eq(rosterRequest.id, data.requestId))
        .for("update");

      if (
        !request ||
        !canAccessRosterLocation(access, { id: request.locationId, siteId: request.siteId })
      ) {
        return { ok: false, formError: ROSTER_NOT_FOUND_MESSAGE };
      }

      if (request.status !== "approved") {
        return { ok: false, formError: REQUEST_NOT_APPROVED_MESSAGE };
      }

      await lockLocation(tx, request.locationId);

      const [existing] = await tx
        .select({ id: roster.id, status: roster.status, updatedAt: roster.updatedAt })
        .from(roster)
        .where(eq(roster.requestId, request.id))
        .for("update");

      if (existing) {
        if (existing.status === "confirmed") {
          return { ok: false, formError: ROSTER_CONFIRMED_MESSAGE };
        }

        if (data.version === null) {
          return { ok: false, formError: ROSTER_EXISTS_MESSAGE };
        }

        if (existing.updatedAt.toISOString() !== data.version) {
          return { ok: false, formError: ROSTER_CHANGED_MESSAGE };
        }
      } else if (data.version !== null) {
        return { ok: false, formError: ROSTER_CHANGED_MESSAGE };
      }

      const lines = await loadRequestLines(tx, request.id);
      const { input: engineInput } = await loadEngineInput(tx, request.id);

      const lineIds = new Set(lines.map((line) => line.lineId));
      const shiftIds = new Set(engineInput.shifts.map((shift) => shift.id));
      const days = new Set(engineInput.days);

      if (
        data.targets.some(
          (target) =>
            !lineIds.has(target.lineId) || !days.has(target.date) || !shiftIds.has(target.shiftId),
        )
      ) {
        return { ok: false, formError: TARGETS_MISMATCH_MESSAGE };
      }

      // A line the request fixed to a shift cannot take headcount on another shift.
      if (targetsMoveFixedLine(lines, data.targets)) {
        return { ok: false, formError: TARGETS_MISMATCH_MESSAGE };
      }

      // Every day must add up to the request's headcount for that day, for every line.
      const fieldErrors: Record<string, string> = {};

      for (const line of lines) {
        engineInput.days.forEach((date, dayIndex) => {
          const split = engineInput.shifts.map(
            (shift) =>
              data.targets.find(
                (target) =>
                  target.lineId === line.lineId && target.date === date && target.shiftId === shift.id,
              )?.headcount ?? 0,
          );
          const error = targetsTotalError([line.perDay[dayIndex] ?? 0], [split]);

          if (error) {
            fieldErrors[`${line.lineId}:${date}`] = targetsTotalMessage(date, error.sum, error.required);
          }
        });
      }

      const firstError = Object.values(fieldErrors)[0];

      if (firstError) {
        return { ok: false, formError: firstError, fieldErrors };
      }

      const output = runEngine({
        ...engineInput,
        targets: data.targets.map((target) => ({
          lineId: target.lineId,
          date: target.date,
          shiftId: target.shiftId,
          headcount: target.headcount,
        })),
      });

      let rosterId: string;

      if (existing) {
        rosterId = existing.id;

        await tx.delete(rosterEdit).where(eq(rosterEdit.rosterId, rosterId));
        await tx.delete(rosterCellEdit).where(eq(rosterCellEdit.rosterId, rosterId));
        await tx.delete(rosterConflict).where(eq(rosterConflict.rosterId, rosterId));
        await tx.delete(rosterAssignment).where(eq(rosterAssignment.rosterId, rosterId));
        await tx.delete(rosterShiftTarget).where(eq(rosterShiftTarget.rosterId, rosterId));
        await tx
          .update(roster)
          .set({ generatedAt: new Date(), generatedBy: user.id })
          .where(eq(roster.id, rosterId));
      } else {
        const [created] = await tx
          .insert(roster)
          .values({ requestId: request.id, status: "draft", generatedBy: user.id })
          .returning({ id: roster.id });

        rosterId = created.id;
      }

      await tx.insert(rosterShiftTarget).values(
        data.targets.map((target) => ({
          rosterId,
          requestLineId: target.lineId,
          workDate: target.date,
          shiftId: target.shiftId,
          headcount: target.headcount,
        })),
      );

      if (output.assignments.length > 0) {
        await tx.insert(rosterAssignment).values(
          output.assignments.map((assignment) => ({
            rosterId,
            requestLineId: assignment.lineId,
            workerId: assignment.workerId,
            workDate: assignment.date,
            kind: assignment.kind,
            shiftId: assignment.shiftId,
          })),
        );
      }

      if (output.conflicts.length > 0) {
        await tx.insert(rosterConflict).values(
          output.conflicts.map((conflict) => ({
            rosterId,
            requestLineId: conflict.lineId,
            workDate: conflict.date,
            shiftId: conflict.shiftId,
            code: conflict.code,
            shortfall: conflict.shortfall,
            message: conflict.message,
          })),
        );
      }

      return { ok: true, rosterId };
    });

    if (result.ok && result.rosterId) {
      revalidateRoster(result.rosterId);
    }

    return result;
  } catch (error) {
    // The transaction has rolled back, so no partial rows are left behind.
    if (isUniqueViolation(error)) {
      return { ok: false, formError: ROSTER_EXISTS_MESSAGE };
    }

    throw error;
  }
}

// The new worker takes the whole row: every assignment of the line moves from the old worker to the
// new one, on the same dates with the same kinds and shifts.
export async function replaceRosterWorker(input: ReplaceWorkerInput): Promise<RosterActionResult> {
  const { user, access } = await requireRosterUser();
  const parsed = replaceWorkerSchema.safeParse(input);

  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const data = parsed.data;

  const result = await db.transaction(async (tx): Promise<RosterActionResult> => {
    const locked = await lockRoster(tx, access, data.rosterId, { serialize: true });

    if (!locked) {
      return { ok: false, formError: ROSTER_NOT_FOUND_MESSAGE };
    }

    const refused = editError(locked, data.version);

    if (refused) {
      return { ok: false, formError: refused };
    }

    const loaded = await loadReplacementContext(tx, {
      rosterId: data.rosterId,
      lineId: data.lineId,
      fromWorkerId: data.fromWorkerId,
      candidateIds: [data.toWorkerId],
    });

    if (!loaded.ok) {
      return {
        ok: false,
        formError: loaded.reason === "line" ? ROSTER_LINE_MISSING_MESSAGE : ROSTER_WORKER_MISSING_MESSAGE,
      };
    }

    const { context } = loaded;
    const candidate = context.candidates.find((entry) => entry.id === data.toWorkerId);

    if (!candidate) {
      return { ok: false, formError: REPLACEMENT_WORKER_MISSING_MESSAGE };
    }

    const check = checkReplacementDetailed({
      row: context.row,
      candidate: {
        id: candidate.id,
        endContract: candidate.endContract,
        positionIds: candidate.positionIds,
      },
      position: context.position,
      alreadyInRoster: candidate.alreadyInRoster,
      otherRosterWorkDates: candidate.otherRosterWorkDates,
      history: candidate.history,
      rules: context.rules,
    });

    // Only the impossible reasons refuse. The rules the editor may knowingly break are returned.
    if (check.hard.length > 0) {
      return { ok: false, formError: check.hard.join(" ") };
    }

    await tx
      .update(rosterAssignment)
      .set({ workerId: data.toWorkerId })
      .where(
        and(
          eq(rosterAssignment.rosterId, data.rosterId),
          eq(rosterAssignment.requestLineId, data.lineId),
          eq(rosterAssignment.workerId, data.fromWorkerId),
        ),
      );

    await tx.insert(rosterEdit).values({
      rosterId: data.rosterId,
      requestLineId: data.lineId,
      fromWorkerId: data.fromWorkerId,
      toWorkerId: data.toWorkerId,
      editedBy: user.id,
    });

    // The new version, so a page loaded before this edit cannot write over it.
    await tx.update(roster).set({ updatedAt: new Date() }).where(eq(roster.id, data.rosterId));

    return { ok: true, warnings: check.warnings };
  });

  if (result.ok) {
    revalidateRoster(data.rosterId);
  }

  return result;
}

export async function confirmRoster(input: ConfirmRosterInput): Promise<RosterActionResult> {
  const { user, access } = await requireRosterUser();
  const parsed = confirmRosterSchema.safeParse(input);

  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const data = parsed.data;

  const result = await db.transaction(async (tx): Promise<RosterActionResult> => {
    const locked = await lockRoster(tx, access, data.rosterId, { serialize: false });

    if (!locked) {
      return { ok: false, formError: ROSTER_NOT_FOUND_MESSAGE };
    }

    const refused = editError(locked, data.version);

    if (refused) {
      return { ok: false, formError: refused };
    }

    await tx
      .update(roster)
      .set({ status: "confirmed", confirmedAt: new Date(), confirmedBy: user.id })
      .where(eq(roster.id, data.rosterId));

    return { ok: true };
  });

  if (result.ok) {
    revalidateRoster(data.rosterId);
  }

  return result;
}

// Read-only, and a server action only because the Replace dialog is a client component. The query
// does its own scope check.
export async function listReplacementCandidates(input: {
  rosterId: string;
  lineId: string;
  fromWorkerId: string;
}): Promise<ReplacementCandidate[]> {
  const { access } = await requireRosterUser();

  if (
    !parseRequestId(input?.rosterId) ||
    !parseRequestId(input?.lineId) ||
    !parseRequestId(input?.fromWorkerId)
  ) {
    return [];
  }

  return replacementCandidates(access, input.rosterId, input.lineId, input.fromWorkerId);
}

// ---- Cell edits. A cell is one worker on one day. Rules are warned about, never refused: only what
// is impossible is refused, and nothing is written for a refusal.

// A roster, line, or worker the context could not load, as the message the editor sees.
function cellContextMessage(reason: Extract<CellContextResult, { ok: false }>["reason"]): string {
  if (reason === "line") return ROSTER_LINE_MISSING_MESSAGE;
  if (reason === "worker") return REPLACEMENT_WORKER_MISSING_MESSAGE;

  return CELL_DATE_MESSAGE;
}

// The roster as the actor sees it, without taking any lock, for the read-only actions. Null when it
// does not exist or is outside the actor's scope.
async function visibleRoster(access: RequestAccess, rosterId: string) {
  const [found] = await db
    .select({ requestId: roster.requestId, status: roster.status })
    .from(roster)
    .where(eq(roster.id, rosterId));

  if (!found) {
    return null;
  }

  const [request] = await db
    .select({
      status: rosterRequest.status,
      siteId: rosterRequest.siteId,
      locationId: rosterRequest.locationId,
    })
    .from(rosterRequest)
    .where(eq(rosterRequest.id, found.requestId));

  if (!request || !canAccessRosterLocation(access, { id: request.locationId, siteId: request.siteId })) {
    return null;
  }

  return { status: found.status, requestStatus: request.status, locationId: request.locationId };
}

const cellAt = (cells: EvalCell[], workerId: string, date: string): EvalCell | undefined =>
  cells.find((cell) => cell.workerId === workerId && cell.date === date);

const sameCell = (a: EvalCell | undefined, b: EvalCell | undefined): boolean =>
  a === undefined ? b === undefined : b !== undefined && a.kind === b.kind && a.shiftId === b.shiftId;

function evaluateCells(context: CellContext, cells: EvalCell[]) {
  return evaluateRoster({
    days: context.dates,
    lines: context.lines,
    workers: context.workers,
    cells,
    targets: context.targets,
    rules: context.rules,
    history: context.history,
  });
}

type CellJudgement = { hard: string } | { hard: null; changes: CellChange[]; warnings: string[] };

// The warnings the changes would introduce. before is the evaluation of the cells as they stand, so
// a caller judging many changes against the same roster computes it once.
function judgeChanges(
  context: CellContext,
  changes: CellChange[],
  before = evaluateCells(context, context.cells),
): CellJudgement {
  const after = evaluateCells(context, changes.reduce(applyCellChange, context.cells));

  return {
    hard: null,
    changes,
    warnings: introducedWarnings(before, after).map((warning) => warning.message),
  };
}

function judgeEdit(context: CellContext, input: PreviewCellInput): CellJudgement {
  const { lineId, workerId, date, to: target } = input;
  const order =
    target.kind === "work" ? context.shifts.find((entry) => entry.id === target.shiftId)?.order : undefined;

  const hard = cellHardError({
    date,
    days: context.dates,
    workerActive: context.workers.some((entry) => entry.id === workerId && entry.active),
    shiftKnown: target.kind !== "work" || order !== undefined,
    rowsThatDay: context.cells.filter((cell) => cell.workerId === workerId && cell.date === date),
    targetLineId: lineId,
    // Clearing a cell books nothing, so another roster's work does not matter to it.
    busyElsewhere:
      target.kind !== "clear" &&
      context.busy.some((entry) => entry.workerId === workerId && entry.date === date),
  });

  if (hard) {
    return { hard };
  }

  const to: CellTarget =
    target.kind === "work"
      ? { kind: "work", shiftId: target.shiftId, shiftOrder: order ?? 0 }
      : { kind: target.kind };

  return judgeChanges(context, [{ lineId, workerId, date, to }]);
}

// The swap hands the old worker's work cell to the new worker and gives the old worker a day off.
// The new worker may have an off cell, a break cell, or no cell that day, but not work.
function judgeSwap(
  context: CellContext,
  input: Pick<SwapCellInput, "lineId" | "date" | "fromWorkerId" | "toWorkerId">,
  before?: ReturnType<typeof evaluateCells>,
): CellJudgement {
  const { lineId, date, fromWorkerId, toWorkerId } = input;

  if (!context.dates.includes(date)) {
    return { hard: CELL_DATE_MESSAGE };
  }

  const from = context.cells.find(
    (cell) =>
      cell.workerId === fromWorkerId &&
      cell.date === date &&
      cell.lineId === lineId &&
      cell.kind === "work",
  );

  if (!from || from.shiftId === null) {
    return { hard: ROSTER_WORKER_MISSING_MESSAGE };
  }

  const rowsThatDay = context.cells.filter((cell) => cell.workerId === toWorkerId && cell.date === date);

  const hard = cellHardError({
    date,
    days: context.dates,
    workerActive: context.workers.some((entry) => entry.id === toWorkerId && entry.active),
    shiftKnown: context.shifts.some((entry) => entry.id === from.shiftId),
    rowsThatDay,
    targetLineId: lineId,
    busyElsewhere: context.busy.some((entry) => entry.workerId === toWorkerId && entry.date === date),
  });

  if (hard) {
    return { hard };
  }

  if (rowsThatDay.some((cell) => cell.kind === "work")) {
    return { hard: CELL_WORKS_THAT_DAY_MESSAGE };
  }

  return judgeChanges(
    context,
    [
      { lineId, workerId: fromWorkerId, date, to: { kind: "off" } },
      {
        lineId,
        workerId: toWorkerId,
        date,
        to: { kind: "work", shiftId: from.shiftId, shiftOrder: from.shiftOrder ?? 0 },
      },
    ],
    before,
  );
}

// Writes each change, with its audit row, then rewrites the roster's shortages for the new cells and
// bumps the version. Returns false, with nothing written, when no change alters a cell.
async function saveCells(
  tx: Transaction,
  input: { rosterId: string; userId: string; context: CellContext; changes: CellChange[] },
): Promise<boolean> {
  const { rosterId, userId, context } = input;
  let cells = context.cells;
  let wrote = false;

  for (const change of input.changes) {
    const before = cellAt(cells, change.workerId, change.date);

    cells = applyCellChange(cells, change);

    const after = cellAt(cells, change.workerId, change.date);

    if (sameCell(before, after)) {
      continue;
    }

    wrote = true;

    const match = and(
      eq(rosterAssignment.rosterId, rosterId),
      eq(rosterAssignment.workerId, change.workerId),
      eq(rosterAssignment.workDate, change.date),
    );

    if (!after) {
      await tx.delete(rosterAssignment).where(match);
    } else if (!before) {
      await tx.insert(rosterAssignment).values({
        rosterId,
        requestLineId: change.lineId,
        workerId: change.workerId,
        workDate: change.date,
        kind: after.kind,
        shiftId: after.shiftId,
      });
    } else {
      await tx
        .update(rosterAssignment)
        .set({ kind: after.kind, shiftId: after.shiftId })
        .where(match);
    }

    await tx.insert(rosterCellEdit).values({
      rosterId,
      requestLineId: change.lineId,
      workerId: change.workerId,
      workDate: change.date,
      beforeKind: before?.kind ?? null,
      beforeShiftId: before?.shiftId ?? null,
      afterKind: after?.kind ?? null,
      afterShiftId: after?.shiftId ?? null,
      editedBy: userId,
    });
  }

  if (!wrote) {
    return false;
  }

  const shortages = shortageRows({
    targets: context.targets,
    cells,
    previous: context.previousConflicts,
  });

  await tx.delete(rosterConflict).where(eq(rosterConflict.rosterId, rosterId));

  if (shortages.length > 0) {
    await tx.insert(rosterConflict).values(
      shortages.map((row) => ({
        rosterId,
        requestLineId: row.lineId,
        workDate: row.date,
        shiftId: row.shiftId,
        code: "shortage",
        shortfall: row.shortfall,
        message: row.message,
      })),
    );
  }

  // The new version, so a page loaded before this edit cannot write over it.
  await tx.update(roster).set({ updatedAt: new Date() }).where(eq(roster.id, rosterId));

  return true;
}

export async function editRosterCell(input: EditCellInput): Promise<RosterActionResult> {
  const { user, access } = await requireRosterUser();
  const parsed = editCellSchema.safeParse(input);

  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const data = parsed.data;
  let changed = false;

  const result = await db.transaction(async (tx): Promise<RosterActionResult> => {
    const locked = await lockRoster(tx, access, data.rosterId, { serialize: true });

    if (!locked) {
      return { ok: false, formError: ROSTER_NOT_FOUND_MESSAGE };
    }

    const refused = editError(locked, data.version);

    if (refused) {
      return { ok: false, formError: refused };
    }

    const loaded = await loadCellContext(tx, {
      rosterId: data.rosterId,
      lineId: data.lineId,
      workerIds: [data.workerId],
    });

    if (!loaded.ok) {
      return { ok: false, formError: cellContextMessage(loaded.reason) };
    }

    const judged = judgeEdit(loaded.context, data);

    if (judged.hard !== null) {
      return { ok: false, formError: judged.hard };
    }

    changed = await saveCells(tx, {
      rosterId: data.rosterId,
      userId: user.id,
      context: loaded.context,
      changes: judged.changes,
    });

    return { ok: true, warnings: changed ? judged.warnings : [] };
  });

  if (result.ok && changed) {
    revalidateRoster(data.rosterId);
  }

  return result;
}

export async function swapRosterCellWorker(input: SwapCellInput): Promise<RosterActionResult> {
  const { user, access } = await requireRosterUser();
  const parsed = swapCellSchema.safeParse(input);

  if (!parsed.success) {
    return invalidInput(parsed.error);
  }

  const data = parsed.data;

  const result = await db.transaction(async (tx): Promise<RosterActionResult> => {
    const locked = await lockRoster(tx, access, data.rosterId, { serialize: true });

    if (!locked) {
      return { ok: false, formError: ROSTER_NOT_FOUND_MESSAGE };
    }

    const refused = editError(locked, data.version);

    if (refused) {
      return { ok: false, formError: refused };
    }

    const loaded = await loadCellContext(tx, {
      rosterId: data.rosterId,
      lineId: data.lineId,
      workerIds: [data.toWorkerId],
    });

    if (!loaded.ok) {
      return { ok: false, formError: cellContextMessage(loaded.reason) };
    }

    const judged = judgeSwap(loaded.context, data);

    if (judged.hard !== null) {
      return { ok: false, formError: judged.hard };
    }

    await saveCells(tx, {
      rosterId: data.rosterId,
      userId: user.id,
      context: loaded.context,
      changes: judged.changes,
    });

    return { ok: true, warnings: judged.warnings };
  });

  if (result.ok) {
    revalidateRoster(data.rosterId);
  }

  return result;
}

// Read-only. The active workers of the location who could take over one cell, each with why not or
// the rules the swap would break. Nothing visible gives an empty list.
export async function listCellCandidates(input: CellCandidatesInput): Promise<CellCandidate[]> {
  const { access } = await requireRosterUser();
  const parsed = cellCandidatesSchema.safeParse(input);

  if (!parsed.success) {
    return [];
  }

  const data = parsed.data;
  const visible = await visibleRoster(access, data.rosterId);

  if (!visible) {
    return [];
  }

  const pool = (await loadLocationWorkers(db, visible.locationId)).filter(
    (entry) => entry.id !== data.fromWorkerId,
  );

  if (pool.length === 0) {
    return [];
  }

  const loaded = await loadCellContext(db, {
    rosterId: data.rosterId,
    lineId: data.lineId,
    workerIds: pool.map((entry) => entry.id),
  });

  if (!loaded.ok) {
    return [];
  }

  const { context } = loaded;
  const before = evaluateCells(context, context.cells);

  return pool.map((entry) => {
    const judged = judgeSwap(
      context,
      { lineId: data.lineId, date: data.date, fromWorkerId: data.fromWorkerId, toWorkerId: entry.id },
      before,
    );

    return {
      workerId: entry.id,
      employeeId: entry.employeeId,
      name: entry.name,
      positionNames: entry.positionNames,
      hard: judged.hard,
      warnings: judged.hard === null ? judged.warnings : [],
      inRoster: context.cells.some((cell) => cell.workerId === entry.id),
    };
  });
}

// Read-only. The active workers of the roster's location who have no cell in the roster yet, for the
// Add worker dialog. A worker already in the roster changes through their own cells. Nothing visible
// gives an empty list.
export async function listAddableWorkers(input: {
  rosterId: string;
  lineId: string;
}): Promise<{ workerId: string; employeeId: string; name: string; positionNames: string[] }[]> {
  const { access } = await requireRosterUser();

  if (!parseRequestId(input?.rosterId) || !parseRequestId(input?.lineId)) {
    return [];
  }

  const visible = await visibleRoster(access, input.rosterId);

  if (!visible) {
    return [];
  }

  const [pool, inRoster] = await Promise.all([
    loadLocationWorkers(db, visible.locationId),
    loadRosterWorkerIds(db, input.rosterId),
  ]);

  return pool
    .filter((entry) => !inRoster.has(entry.id))
    .map((entry) => ({
      workerId: entry.id,
      employeeId: entry.employeeId,
      name: entry.name,
      positionNames: entry.positionNames,
    }));
}

// Read-only. What editRosterCell would refuse or warn about for this change, without writing and
// without a version. Anything not visible answers as a roster that was not found.
export async function previewCellChange(
  input: PreviewCellInput,
): Promise<{ hard: string | null; warnings: string[] }> {
  const { access } = await requireRosterUser();
  const parsed = previewCellSchema.safeParse(input);
  const notFound = { hard: ROSTER_NOT_FOUND_MESSAGE, warnings: [] };

  if (!parsed.success) {
    return notFound;
  }

  const data = parsed.data;
  const visible = await visibleRoster(access, data.rosterId);

  if (!visible) {
    return notFound;
  }

  const refused = statusError(visible);

  if (refused) {
    return { hard: refused, warnings: [] };
  }

  const loaded = await loadCellContext(db, {
    rosterId: data.rosterId,
    lineId: data.lineId,
    workerIds: [data.workerId],
  });

  if (!loaded.ok) {
    return { hard: cellContextMessage(loaded.reason), warnings: [] };
  }

  const judged = judgeEdit(loaded.context, data);

  return judged.hard === null
    ? { hard: null, warnings: judged.warnings }
    : { hard: judged.hard, warnings: [] };
}
