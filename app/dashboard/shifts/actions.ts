"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { shift } from "@/database/schema/shift-schema";
import { site } from "@/database/schema/site-schema";
import { db } from "@/lib/db";
import type {
  ShiftAccess,
  ShiftActionResult,
  ShiftBulkDeleteResult,
  ShiftBulkRestoreResult,
} from "@/types/shifts";
import {
  shiftSchema,
  shiftUpdateSchema,
  type ShiftInput,
  type ShiftUpdateInput,
} from "@/validation/shift";
import { canWriteToSite } from "./shift-access";
import { requireShiftManager } from "./shift-guard";
import {
  canRestoreShift,
  DUPLICATE_SHIFT_NAME_MESSAGE,
  DUPLICATE_SHIFT_ORDER_MESSAGE,
  SHIFT_NOT_FOUND_MESSAGE,
  SHIFT_RESTORE_CONFLICT_MESSAGE,
  shiftConflictField,
  shiftFieldErrors,
  SITE_NOT_FOUND_MESSAGE,
} from "./shift-rules";
import { shiftScopeFilter } from "./shifts";

const SHIFTS_PATH = "/dashboard/shifts";

// A unique violation names the field that clashes, so the form can mark it.
function conflictResult(field: "order" | "name"): ShiftActionResult {
  return {
    ok: false,
    fieldErrors:
      field === "order"
        ? { order: DUPLICATE_SHIFT_ORDER_MESSAGE }
        : { name: DUPLICATE_SHIFT_NAME_MESSAGE },
  };
}

export async function createShift(input: ShiftInput): Promise<ShiftActionResult> {
  const access = await requireShiftManager();

  const parsed = shiftSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, fieldErrors: shiftFieldErrors(parsed.error.issues) };
  }

  try {
    // The share lock conflicts with the update lock a site delete takes, so the site cannot be
    // deleted between this check and the insert. The site id comes from the client, so it is
    // loaded and checked against the caller's scope.
    const result = await db.transaction(async (tx) => {
      const [target] = await tx
        .select({ id: site.id })
        .from(site)
        .where(and(eq(site.id, parsed.data.siteId), isNull(site.deletedAt)))
        .for("share");

      if (!target || !canWriteToSite(access, target.id)) {
        return { ok: false as const, formError: SITE_NOT_FOUND_MESSAGE };
      }

      await tx.insert(shift).values({
        siteId: target.id,
        order: parsed.data.order,
        name: parsed.data.name,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
      });

      return { ok: true as const };
    });

    if (!result.ok) {
      return result;
    }
  } catch (error) {
    const field = shiftConflictField(error);

    if (field) {
      return conflictResult(field);
    }

    throw error;
  }

  revalidatePath(SHIFTS_PATH);

  return { ok: true };
}

// Order, name, and times change. A shift keeps its site after it is created.
export async function updateShift(
  id: string,
  input: ShiftUpdateInput,
): Promise<ShiftActionResult> {
  const access = await requireShiftManager();

  const parsed = shiftUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, fieldErrors: shiftFieldErrors(parsed.error.issues) };
  }

  try {
    const updated = await db
      .update(shift)
      .set({
        order: parsed.data.order,
        name: parsed.data.name,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
      })
      .where(and(eq(shift.id, id), isNull(shift.deletedAt), shiftScopeFilter(access)))
      .returning({ id: shift.id });

    if (updated.length === 0) {
      return { ok: false, formError: SHIFT_NOT_FOUND_MESSAGE };
    }
  } catch (error) {
    const field = shiftConflictField(error);

    if (field) {
      return conflictResult(field);
    }

    throw error;
  }

  revalidatePath(SHIFTS_PATH);

  return { ok: true };
}

// Soft-deletes one shift. The caller has already passed requireShiftManager(). Nothing refers to a
// shift yet, so one guarded update is enough. Once rosters exist, check their usage here.
async function softDeleteShift(id: string, access: ShiftAccess): Promise<ShiftActionResult> {
  const deleted = await db
    .update(shift)
    .set({ deletedAt: new Date() })
    .where(and(eq(shift.id, id), isNull(shift.deletedAt), shiftScopeFilter(access)))
    .returning({ id: shift.id });

  return deleted.length === 0
    ? { ok: false, formError: SHIFT_NOT_FOUND_MESSAGE }
    : { ok: true };
}

export async function deleteShift(id: string): Promise<ShiftActionResult> {
  const access = await requireShiftManager();

  const result = await softDeleteShift(id, access);

  if (result.ok) {
    revalidatePath(SHIFTS_PATH);
  }

  return result;
}

// Restores one shift. The caller has already passed requireShiftManager().
async function restoreOne(id: string, access: ShiftAccess): Promise<ShiftActionResult> {
  try {
    // The share lock on the site conflicts with the update lock a site delete takes, so the site
    // cannot be deleted between the check and the restore. Without it a site delete could count
    // this shift as deleted, commit, and leave it active under a deleted site.
    return await db.transaction(async (tx) => {
      const [target] = await tx
        .select({ id: shift.id, siteId: shift.siteId })
        .from(shift)
        .where(and(eq(shift.id, id), isNotNull(shift.deletedAt), shiftScopeFilter(access)));

      if (!target) {
        return { ok: false as const, formError: SHIFT_NOT_FOUND_MESSAGE };
      }

      const [owner] = await tx
        .select({ deletedAt: site.deletedAt })
        .from(site)
        .where(eq(site.id, target.siteId))
        .for("share");

      const verdict = canRestoreShift({ siteDeleted: owner.deletedAt !== null });

      if (!verdict.ok) {
        return { ok: false as const, formError: verdict.formError };
      }

      const restored = await tx
        .update(shift)
        .set({ deletedAt: null })
        .where(and(eq(shift.id, id), isNotNull(shift.deletedAt), shiftScopeFilter(access)))
        .returning({ id: shift.id });

      if (restored.length === 0) {
        return { ok: false as const, formError: SHIFT_NOT_FOUND_MESSAGE };
      }

      return { ok: true as const };
    });
  } catch (error) {
    if (shiftConflictField(error)) {
      return { ok: false, formError: SHIFT_RESTORE_CONFLICT_MESSAGE };
    }

    throw error;
  }
}

export async function restoreShift(id: string): Promise<ShiftActionResult> {
  const access = await requireShiftManager();

  const result = await restoreOne(id, access);

  if (result.ok) {
    revalidatePath(SHIFTS_PATH);
  }

  return result;
}

// Each shift is checked on its own, so some can be deleted while others are blocked.
export async function deleteShifts(ids: string[]): Promise<ShiftBulkDeleteResult> {
  const access = await requireShiftManager();

  const deletedIds: string[] = [];
  const blocked: ShiftBulkDeleteResult["blocked"] = [];

  for (const id of ids) {
    const result = await softDeleteShift(id, access);

    if (result.ok) {
      deletedIds.push(id);
    } else {
      blocked.push({ id, formError: result.formError ?? SHIFT_NOT_FOUND_MESSAGE });
    }
  }

  if (deletedIds.length > 0) {
    revalidatePath(SHIFTS_PATH);
  }

  return { deletedIds, blocked };
}

// Each shift is checked on its own, so some can be restored while others are blocked.
export async function restoreShifts(ids: string[]): Promise<ShiftBulkRestoreResult> {
  const access = await requireShiftManager();

  const restoredIds: string[] = [];
  const blocked: ShiftBulkRestoreResult["blocked"] = [];

  for (const id of ids) {
    const result = await restoreOne(id, access);

    if (result.ok) {
      restoredIds.push(id);
    } else {
      blocked.push({ id, formError: result.formError ?? SHIFT_NOT_FOUND_MESSAGE });
    }
  }

  if (restoredIds.length > 0) {
    revalidatePath(SHIFTS_PATH);
  }

  return { restoredIds, blocked };
}
