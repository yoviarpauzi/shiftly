"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { position } from "@/database/schema/position-schema";
import { site } from "@/database/schema/site-schema";
import { worker, workerPosition } from "@/database/schema/worker-schema";
import { db } from "@/lib/db";
import type {
  PositionAccess,
  PositionActionResult,
  PositionBulkDeleteResult,
  PositionBulkRestoreResult,
} from "@/types/positions";
import {
  positionNameSchema,
  positionSchema,
  type PositionInput,
  type PositionNameInput,
} from "@/validation/position";
import { canWriteToSite } from "./position-access";
import { requirePositionManager } from "./position-guard";
import {
  canDeletePosition,
  canRestorePosition,
  DUPLICATE_POSITION_NAME_MESSAGE,
  isPositionNameConflict,
  POSITION_NOT_FOUND_MESSAGE,
  POSITION_RESTORE_CONFLICT_MESSAGE,
  SITE_NOT_FOUND_MESSAGE,
} from "./position-rules";
import { positionScopeFilter } from "./positions";

const POSITIONS_PATH = "/dashboard/positions";

export async function createPosition(input: PositionInput): Promise<PositionActionResult> {
  const access = await requirePositionManager();

  const parsed = positionSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, fieldErrors: { name: parsed.error.issues[0].message } };
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

      await tx.insert(position).values({ name: parsed.data.name, siteId: target.id });

      return { ok: true as const };
    });

    if (!result.ok) {
      return result;
    }
  } catch (error) {
    if (isPositionNameConflict(error)) {
      return { ok: false, fieldErrors: { name: DUPLICATE_POSITION_NAME_MESSAGE } };
    }

    throw error;
  }

  revalidatePath(POSITIONS_PATH);

  return { ok: true };
}

// Only the name changes. A position keeps its site after it is created.
export async function updatePosition(
  id: string,
  input: PositionNameInput,
): Promise<PositionActionResult> {
  const access = await requirePositionManager();

  const parsed = positionNameSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, fieldErrors: { name: parsed.error.issues[0].message } };
  }

  try {
    const updated = await db
      .update(position)
      .set({ name: parsed.data.name })
      .where(and(eq(position.id, id), isNull(position.deletedAt), positionScopeFilter(access)))
      .returning({ id: position.id });

    if (updated.length === 0) {
      return { ok: false, formError: POSITION_NOT_FOUND_MESSAGE };
    }
  } catch (error) {
    if (isPositionNameConflict(error)) {
      return { ok: false, fieldErrors: { name: DUPLICATE_POSITION_NAME_MESSAGE } };
    }

    throw error;
  }

  revalidatePath(POSITIONS_PATH);

  return { ok: true };
}

// Soft-deletes one position unless an active worker still has it. The caller has already passed
// requirePositionManager(). The row lock stops a worker from being given this position until the
// check has run, because saving a worker takes a share lock on its positions.
async function softDeletePosition(
  id: string,
  access: PositionAccess,
): Promise<PositionActionResult> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: position.id })
      .from(position)
      .where(and(eq(position.id, id), isNull(position.deletedAt), positionScopeFilter(access)))
      .for("update");

    if (!target) {
      return { ok: false as const, formError: POSITION_NOT_FOUND_MESSAGE };
    }

    const [{ value: activeWorkers }] = await tx
      .select({ value: count() })
      .from(workerPosition)
      .innerJoin(worker, eq(worker.id, workerPosition.workerId))
      .where(and(eq(workerPosition.positionId, id), isNull(worker.deletedAt)));

    const verdict = canDeletePosition({ activeWorkers });

    if (!verdict.ok) {
      return { ok: false as const, formError: verdict.formError };
    }

    await tx.update(position).set({ deletedAt: new Date() }).where(eq(position.id, id));

    return { ok: true as const };
  });
}

export async function deletePosition(id: string): Promise<PositionActionResult> {
  const access = await requirePositionManager();

  const result = await softDeletePosition(id, access);

  if (result.ok) {
    revalidatePath(POSITIONS_PATH);
  }

  return result;
}

// Restores one position. The caller has already passed requirePositionManager().
async function restoreOne(id: string, access: PositionAccess): Promise<PositionActionResult> {
  try {
    // The share lock on the site conflicts with the update lock a site delete takes, so the site
    // cannot be deleted between the check and the restore. Without it a site delete could count
    // this position as deleted, commit, and leave it active under a deleted site.
    return await db.transaction(async (tx) => {
      const [target] = await tx
        .select({ id: position.id, siteId: position.siteId })
        .from(position)
        .where(
          and(eq(position.id, id), isNotNull(position.deletedAt), positionScopeFilter(access)),
        );

      if (!target) {
        return { ok: false as const, formError: POSITION_NOT_FOUND_MESSAGE };
      }

      const [owner] = await tx
        .select({ deletedAt: site.deletedAt })
        .from(site)
        .where(eq(site.id, target.siteId))
        .for("share");

      const verdict = canRestorePosition({ siteDeleted: owner.deletedAt !== null });

      if (!verdict.ok) {
        return { ok: false as const, formError: verdict.formError };
      }

      const restored = await tx
        .update(position)
        .set({ deletedAt: null })
        .where(
          and(eq(position.id, id), isNotNull(position.deletedAt), positionScopeFilter(access)),
        )
        .returning({ id: position.id });

      if (restored.length === 0) {
        return { ok: false as const, formError: POSITION_NOT_FOUND_MESSAGE };
      }

      return { ok: true as const };
    });
  } catch (error) {
    if (isPositionNameConflict(error)) {
      return { ok: false, formError: POSITION_RESTORE_CONFLICT_MESSAGE };
    }

    throw error;
  }
}

export async function restorePosition(id: string): Promise<PositionActionResult> {
  const access = await requirePositionManager();

  const result = await restoreOne(id, access);

  if (result.ok) {
    revalidatePath(POSITIONS_PATH);
  }

  return result;
}

// Each position is checked on its own, so some can be deleted while others are blocked.
export async function deletePositions(ids: string[]): Promise<PositionBulkDeleteResult> {
  const access = await requirePositionManager();

  const deletedIds: string[] = [];
  const blocked: PositionBulkDeleteResult["blocked"] = [];

  for (const id of ids) {
    const result = await softDeletePosition(id, access);

    if (result.ok) {
      deletedIds.push(id);
    } else {
      blocked.push({ id, formError: result.formError ?? POSITION_NOT_FOUND_MESSAGE });
    }
  }

  if (deletedIds.length > 0) {
    revalidatePath(POSITIONS_PATH);
  }

  return { deletedIds, blocked };
}

// Each position is checked on its own, so some can be restored while others are blocked.
export async function restorePositions(ids: string[]): Promise<PositionBulkRestoreResult> {
  const access = await requirePositionManager();

  const restoredIds: string[] = [];
  const blocked: PositionBulkRestoreResult["blocked"] = [];

  for (const id of ids) {
    const result = await restoreOne(id, access);

    if (result.ok) {
      restoredIds.push(id);
    } else {
      blocked.push({ id, formError: result.formError ?? POSITION_NOT_FOUND_MESSAGE });
    }
  }

  if (restoredIds.length > 0) {
    revalidatePath(POSITIONS_PATH);
  }

  return { restoredIds, blocked };
}
