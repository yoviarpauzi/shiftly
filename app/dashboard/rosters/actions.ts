"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import type { ZodError } from "zod";
import { rosterRequest } from "@/database/schema/request-schema";
import {
  roster,
  rosterAssignment,
  rosterConflict,
  rosterEdit,
  rosterShiftTarget,
} from "@/database/schema/roster-schema";
import { db } from "@/lib/db";
import type { RequestAccess, Transaction } from "@/types/requests";
import type { ReplacementCandidate, RosterActionResult } from "@/types/rosters";
import {
  confirmRosterSchema,
  generateRosterSchema,
  replaceWorkerSchema,
  type ConfirmRosterInput,
  type GenerateRosterInput,
  type ReplaceWorkerInput,
} from "@/validation/rosters";
import { parseRequestId } from "@/validation/request-id";
import { canAccessRosterLocation } from "./roster-access";
import { generateRoster as runEngine } from "./roster-engine";
import { requireRosterUser } from "./roster-guard";
import { checkReplacement } from "./roster-replacement";
import {
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
  targetsTotalError,
  targetsTotalMessage,
} from "./roster-rules";
import {
  loadEngineInput,
  loadReplacementContext,
  loadRequestLines,
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

// A roster is read-only once its request is no longer approved, or once it is confirmed, and an
// edit made on an old version would overwrite a newer one.
function editError(
  row: { status: string; updatedAt: Date; requestStatus: string },
  version: string,
): string | null {
  if (row.requestStatus !== "approved") return REQUEST_NOT_APPROVED_MESSAGE;
  if (row.status === "confirmed") return ROSTER_CONFIRMED_MESSAGE;
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

    const check = checkReplacement({
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

    if (!check.ok) {
      return { ok: false, formError: check.reasons.join(" ") };
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

    return { ok: true };
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
