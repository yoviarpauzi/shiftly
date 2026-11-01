"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { position } from "@/database/schema/position-schema";
import { site } from "@/database/schema/site-schema";
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

// Soft-deletes one position. The caller has already passed requirePositionManager().
async function softDeletePosition(
  id: string,
  access: PositionAccess,
): Promise<PositionActionResult> {
  const deleted = await db
    .update(position)
    .set({ deletedAt: new Date() })
    .where(and(eq(position.id, id), isNull(position.deletedAt), positionScopeFilter(access)))
    .returning({ id: position.id });

  if (deleted.length === 0) {
    return { ok: false, formError: POSITION_NOT_FOUND_MESSAGE };
  }

  return { ok: true };
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
  const [target] = await db
    .select({ id: position.id, siteDeletedAt: site.deletedAt })
    .from(position)
    .innerJoin(site, eq(site.id, position.siteId))
    .where(and(eq(position.id, id), isNotNull(position.deletedAt), positionScopeFilter(access)));

  if (!target) {
    return { ok: false, formError: POSITION_NOT_FOUND_MESSAGE };
  }

  const verdict = canRestorePosition({ siteDeleted: target.siteDeletedAt !== null });

  if (!verdict.ok) {
    return { ok: false, formError: verdict.formError };
  }

  try {
    const restored = await db
      .update(position)
      .set({ deletedAt: null })
      .where(and(eq(position.id, id), isNotNull(position.deletedAt), positionScopeFilter(access)))
      .returning({ id: position.id });

    if (restored.length === 0) {
      return { ok: false, formError: POSITION_NOT_FOUND_MESSAGE };
    }
  } catch (error) {
    if (isPositionNameConflict(error)) {
      return { ok: false, formError: POSITION_RESTORE_CONFLICT_MESSAGE };
    }

    throw error;
  }

  return { ok: true };
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
