"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { location } from "@/database/schema/location-schema";
import { position } from "@/database/schema/position-schema";
import { site } from "@/database/schema/site-schema";
import { worker } from "@/database/schema/worker-schema";
import { db } from "@/lib/db";
import type {
  WorkerAccess,
  WorkerActionResult,
  WorkerBulkDeleteResult,
  WorkerBulkRestoreResult,
  WorkerFieldErrors,
} from "@/types/workers";
import {
  workerSchema,
  type WorkerData,
  type WorkerInput,
} from "@/validation/worker";
import { canWriteWorker } from "./worker-access";
import { requireWorkerManager } from "./worker-guard";
import {
  canRestoreWorker,
  DUPLICATE_EMPLOYEE_ID_MESSAGE,
  isEmployeeIdConflict,
  LOCATION_NOT_FOUND_MESSAGE,
  POSITIONS_NOT_FOUND_MESSAGE,
  SITE_NOT_FOUND_MESSAGE,
  WORKER_NOT_FOUND_MESSAGE,
  WORKER_RESTORE_CONFLICT_MESSAGE,
} from "./worker-rules";
import { replacePositions, type Transaction } from "./worker-write";
import { workerScopeFilter } from "./workers";

const WORKERS_PATH = "/dashboard/workers";

const FIELD_KEYS: (keyof WorkerFieldErrors)[] = [
  "employeeId",
  "name",
  "siteId",
  "locationId",
  "positionIds",
];

// First message per field, so the form can show each one under its input.
function fieldErrorsOf(
  issues: { path: PropertyKey[]; message: string }[],
): WorkerFieldErrors {
  const errors: WorkerFieldErrors = {};

  for (const issue of issues) {
    const key = issue.path[0] as keyof WorkerFieldErrors;

    if (FIELD_KEYS.includes(key)) {
      errors[key] ??= issue.message;
    }
  }

  return errors;
}

// The site id, location id, and position ids come from the client. They are loaded and checked
// against the caller's scope. The share lock on the site conflicts with the update lock a site
// delete takes, so the site cannot be deleted between this check and the write.
async function checkTargets(
  tx: Transaction,
  access: WorkerAccess,
  data: WorkerData,
): Promise<WorkerActionResult> {
  const [targetSite] = await tx
    .select({ id: site.id })
    .from(site)
    .where(and(eq(site.id, data.siteId), isNull(site.deletedAt)))
    .for("share");

  if (!targetSite) {
    return { ok: false, formError: SITE_NOT_FOUND_MESSAGE };
  }

  const [targetLocation] = await tx
    .select({ id: location.id })
    .from(location)
    .where(
      and(
        eq(location.id, data.locationId),
        eq(location.siteId, targetSite.id),
        isNull(location.deletedAt),
      ),
    )
    .for("share");

  if (!targetLocation) {
    return {
      ok: false,
      fieldErrors: { locationId: LOCATION_NOT_FOUND_MESSAGE },
    };
  }

  if (
    !canWriteWorker(access, {
      siteId: targetSite.id,
      locationId: targetLocation.id,
    })
  ) {
    return { ok: false, formError: SITE_NOT_FOUND_MESSAGE };
  }

  if (data.positionIds.length > 0) {
    // The share lock conflicts with the update lock a position delete takes, so a position
    // cannot be deleted between this check and the write.
    const found = await tx
      .select({ id: position.id })
      .from(position)
      .where(
        and(
          inArray(position.id, data.positionIds),
          eq(position.siteId, targetSite.id),
          isNull(position.deletedAt),
        ),
      )
      .for("share");

    if (found.length !== data.positionIds.length) {
      return {
        ok: false,
        fieldErrors: { positionIds: POSITIONS_NOT_FOUND_MESSAGE },
      };
    }
  }

  return { ok: true };
}

export async function createWorker(
  input: WorkerInput,
): Promise<WorkerActionResult> {
  const access = await requireWorkerManager();

  const parsed = workerSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }

  const data = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      const checked = await checkTargets(tx, access, data);

      if (!checked.ok) {
        return checked;
      }

      const [created] = await tx
        .insert(worker)
        .values({
          employeeId: data.employeeId,
          name: data.name,
          siteId: data.siteId,
          locationId: data.locationId,
        })
        .returning({ id: worker.id });

      await replacePositions(tx, created.id, data.positionIds);

      return { ok: true as const };
    });

    if (!result.ok) {
      return result;
    }
  } catch (error) {
    if (isEmployeeIdConflict(error)) {
      return {
        ok: false,
        fieldErrors: { employeeId: DUPLICATE_EMPLOYEE_ID_MESSAGE },
      };
    }

    throw error;
  }

  revalidatePath(WORKERS_PATH);

  return { ok: true };
}

export async function updateWorker(
  id: string,
  input: WorkerInput,
): Promise<WorkerActionResult> {
  const access = await requireWorkerManager();

  const parsed = workerSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }

  const data = parsed.data;

  try {
    const result = await db.transaction(async (tx) => {
      const checked = await checkTargets(tx, access, data);

      if (!checked.ok) {
        return checked;
      }

      const updated = await tx
        .update(worker)
        .set({
          employeeId: data.employeeId,
          name: data.name,
          siteId: data.siteId,
          locationId: data.locationId,
        })
        .where(
          and(
            eq(worker.id, id),
            isNull(worker.deletedAt),
            workerScopeFilter(access),
          ),
        )
        .returning({ id: worker.id });

      if (updated.length === 0) {
        return { ok: false as const, formError: WORKER_NOT_FOUND_MESSAGE };
      }

      await replacePositions(tx, id, data.positionIds);

      return { ok: true as const };
    });

    if (!result.ok) {
      return result;
    }
  } catch (error) {
    if (isEmployeeIdConflict(error)) {
      return {
        ok: false,
        fieldErrors: { employeeId: DUPLICATE_EMPLOYEE_ID_MESSAGE },
      };
    }

    throw error;
  }

  revalidatePath(WORKERS_PATH);

  return { ok: true };
}

// Soft-deletes one worker. The caller has already passed requireWorkerManager().
async function softDeleteWorker(
  id: string,
  access: WorkerAccess,
): Promise<WorkerActionResult> {
  const deleted = await db
    .update(worker)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(worker.id, id),
        isNull(worker.deletedAt),
        workerScopeFilter(access),
      ),
    )
    .returning({ id: worker.id });

  if (deleted.length === 0) {
    return { ok: false, formError: WORKER_NOT_FOUND_MESSAGE };
  }

  return { ok: true };
}

export async function deleteWorker(id: string): Promise<WorkerActionResult> {
  const access = await requireWorkerManager();

  const result = await softDeleteWorker(id, access);

  if (result.ok) {
    revalidatePath(WORKERS_PATH);
  }

  return result;
}

// Restores one worker. The caller has already passed requireWorkerManager().
async function restoreOne(
  id: string,
  access: WorkerAccess,
): Promise<WorkerActionResult> {
  try {
    // The share locks conflict with the update locks a site or location delete takes, so neither
    // can be deleted between the check and the restore.
    return await db.transaction(async (tx) => {
      const [target] = await tx
        .select({ siteId: worker.siteId, locationId: worker.locationId })
        .from(worker)
        .where(
          and(
            eq(worker.id, id),
            isNotNull(worker.deletedAt),
            workerScopeFilter(access),
          ),
        );

      if (!target) {
        return { ok: false as const, formError: WORKER_NOT_FOUND_MESSAGE };
      }

      const [owner] = await tx
        .select({ deletedAt: site.deletedAt })
        .from(site)
        .where(eq(site.id, target.siteId))
        .for("share");

      const [place] = await tx
        .select({ deletedAt: location.deletedAt })
        .from(location)
        .where(eq(location.id, target.locationId))
        .for("share");

      const verdict = canRestoreWorker({
        siteDeleted: owner.deletedAt !== null,
        locationDeleted: place.deletedAt !== null,
      });

      if (!verdict.ok) {
        return { ok: false as const, formError: verdict.formError };
      }

      await tx.update(worker).set({ deletedAt: null }).where(eq(worker.id, id));

      return { ok: true as const };
    });
  } catch (error) {
    if (isEmployeeIdConflict(error)) {
      return { ok: false, formError: WORKER_RESTORE_CONFLICT_MESSAGE };
    }

    throw error;
  }
}

export async function restoreWorker(id: string): Promise<WorkerActionResult> {
  const access = await requireWorkerManager();

  const result = await restoreOne(id, access);

  if (result.ok) {
    revalidatePath(WORKERS_PATH);
  }

  return result;
}

// Each worker is checked on its own, so some can be deleted while others are blocked.
export async function deleteWorkers(
  ids: string[],
): Promise<WorkerBulkDeleteResult> {
  const access = await requireWorkerManager();

  const deletedIds: string[] = [];
  const blocked: WorkerBulkDeleteResult["blocked"] = [];

  for (const id of ids) {
    const result = await softDeleteWorker(id, access);

    if (result.ok) {
      deletedIds.push(id);
    } else {
      blocked.push({
        id,
        formError: result.formError ?? WORKER_NOT_FOUND_MESSAGE,
      });
    }
  }

  if (deletedIds.length > 0) {
    revalidatePath(WORKERS_PATH);
  }

  return { deletedIds, blocked };
}

// Each worker is checked on its own, so some can be restored while others are blocked.
export async function restoreWorkers(
  ids: string[],
): Promise<WorkerBulkRestoreResult> {
  const access = await requireWorkerManager();

  const restoredIds: string[] = [];
  const blocked: WorkerBulkRestoreResult["blocked"] = [];

  for (const id of ids) {
    const result = await restoreOne(id, access);

    if (result.ok) {
      restoredIds.push(id);
    } else {
      blocked.push({
        id,
        formError: result.formError ?? WORKER_NOT_FOUND_MESSAGE,
      });
    }
  }

  if (restoredIds.length > 0) {
    revalidatePath(WORKERS_PATH);
  }

  return { restoredIds, blocked };
}
