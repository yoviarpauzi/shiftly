"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { department, subDepartment } from "@/database/schema/department-schema";
import { location } from "@/database/schema/location-schema";
import { db } from "@/lib/db";
import type {
  DepartmentAccess,
  DepartmentActionResult,
  DepartmentBulkDeleteResult,
  DepartmentBulkRestoreResult,
} from "@/types/departments";
import {
  departmentNameSchema,
  departmentSchema,
  type DepartmentInput,
  type DepartmentNameInput,
} from "@/validation/department";
import { canWriteToLocation } from "./department-access";
import { requireDepartmentManager } from "./department-guard";
import {
  canDeleteDepartment,
  canRestoreDepartment,
  DEPARTMENT_NOT_FOUND_MESSAGE,
  DEPARTMENT_RESTORE_CONFLICT_MESSAGE,
  DUPLICATE_DEPARTMENT_NAME_MESSAGE,
  isDepartmentNameConflict,
} from "./department-rules";
import { departmentScopeFilter, findLocationForWrite } from "./departments";

const DEPARTMENTS_PATH = "/dashboard/departments";

const LOCATION_NOT_FOUND_MESSAGE = "Location not found";

export async function createDepartment(input: DepartmentInput): Promise<DepartmentActionResult> {
  const access = await requireDepartmentManager();

  const parsed = departmentSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, fieldErrors: { name: parsed.error.issues[0].message } };
  }

  // The location id comes from the client, so it is loaded and checked against the caller's scope.
  const target = await findLocationForWrite(parsed.data.locationId);

  if (!target || !canWriteToLocation(access, target)) {
    return { ok: false, formError: LOCATION_NOT_FOUND_MESSAGE };
  }

  try {
    await db.insert(department).values({
      name: parsed.data.name,
      locationId: target.id,
    });
  } catch (error) {
    if (isDepartmentNameConflict(error)) {
      return { ok: false, fieldErrors: { name: DUPLICATE_DEPARTMENT_NAME_MESSAGE } };
    }

    throw error;
  }

  revalidatePath(DEPARTMENTS_PATH);

  return { ok: true };
}

// Only the name changes. A department keeps its location after it is created.
export async function updateDepartment(
  id: string,
  input: DepartmentNameInput,
): Promise<DepartmentActionResult> {
  const access = await requireDepartmentManager();

  const parsed = departmentNameSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, fieldErrors: { name: parsed.error.issues[0].message } };
  }

  try {
    const updated = await db
      .update(department)
      .set({ name: parsed.data.name })
      .where(
        and(
          eq(department.id, id),
          isNull(department.deletedAt),
          departmentScopeFilter(access),
        ),
      )
      .returning({ id: department.id });

    if (updated.length === 0) {
      return { ok: false, formError: DEPARTMENT_NOT_FOUND_MESSAGE };
    }
  } catch (error) {
    if (isDepartmentNameConflict(error)) {
      return { ok: false, fieldErrors: { name: DUPLICATE_DEPARTMENT_NAME_MESSAGE } };
    }

    throw error;
  }

  revalidatePath(DEPARTMENTS_PATH);

  return { ok: true };
}

// Checks and soft-deletes one department. The caller has already passed requireDepartmentManager().
async function softDeleteDepartment(
  id: string,
  access: DepartmentAccess,
): Promise<DepartmentActionResult> {
  // The row lock stops a sub-department from being added under this department until the checks have run.
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: department.id })
      .from(department)
      .where(
        and(
          eq(department.id, id),
          isNull(department.deletedAt),
          departmentScopeFilter(access),
        ),
      )
      .for("update");

    if (!target) {
      return { ok: false as const, formError: DEPARTMENT_NOT_FOUND_MESSAGE };
    }

    const [{ value: activeSubDepartments }] = await tx
      .select({ value: count() })
      .from(subDepartment)
      .where(and(eq(subDepartment.departmentId, id), isNull(subDepartment.deletedAt)));

    const verdict = canDeleteDepartment({ activeSubDepartments });

    if (!verdict.ok) {
      return { ok: false as const, formError: verdict.formError };
    }

    await tx
      .update(department)
      .set({ deletedAt: new Date() })
      .where(and(eq(department.id, id), departmentScopeFilter(access)));

    return { ok: true as const };
  });
}

export async function deleteDepartment(id: string): Promise<DepartmentActionResult> {
  const access = await requireDepartmentManager();

  const result = await softDeleteDepartment(id, access);

  if (result.ok) {
    revalidatePath(DEPARTMENTS_PATH);
  }

  return result;
}

// Restores one department. The caller has already passed requireDepartmentManager().
async function restoreOne(id: string, access: DepartmentAccess): Promise<DepartmentActionResult> {
  const [target] = await db
    .select({ id: department.id, locationDeletedAt: location.deletedAt })
    .from(department)
    .innerJoin(location, eq(location.id, department.locationId))
    .where(
      and(
        eq(department.id, id),
        isNotNull(department.deletedAt),
        departmentScopeFilter(access),
      ),
    );

  if (!target) {
    return { ok: false, formError: DEPARTMENT_NOT_FOUND_MESSAGE };
  }

  const verdict = canRestoreDepartment({ locationDeleted: target.locationDeletedAt !== null });

  if (!verdict.ok) {
    return { ok: false, formError: verdict.formError };
  }

  try {
    const restored = await db
      .update(department)
      .set({ deletedAt: null })
      .where(
        and(
          eq(department.id, id),
          isNotNull(department.deletedAt),
          departmentScopeFilter(access),
        ),
      )
      .returning({ id: department.id });

    if (restored.length === 0) {
      return { ok: false, formError: DEPARTMENT_NOT_FOUND_MESSAGE };
    }
  } catch (error) {
    if (isDepartmentNameConflict(error)) {
      return { ok: false, formError: DEPARTMENT_RESTORE_CONFLICT_MESSAGE };
    }

    throw error;
  }

  return { ok: true };
}

export async function restoreDepartment(id: string): Promise<DepartmentActionResult> {
  const access = await requireDepartmentManager();

  const result = await restoreOne(id, access);

  if (result.ok) {
    revalidatePath(DEPARTMENTS_PATH);
  }

  return result;
}

// Each department is checked on its own, so some can be deleted while others are blocked.
export async function deleteDepartments(ids: string[]): Promise<DepartmentBulkDeleteResult> {
  const access = await requireDepartmentManager();

  const deletedIds: string[] = [];
  const blocked: DepartmentBulkDeleteResult["blocked"] = [];

  for (const id of ids) {
    const result = await softDeleteDepartment(id, access);

    if (result.ok) {
      deletedIds.push(id);
    } else {
      blocked.push({
        id,
        formError: result.formError ?? DEPARTMENT_NOT_FOUND_MESSAGE,
      });
    }
  }

  if (deletedIds.length > 0) {
    revalidatePath(DEPARTMENTS_PATH);
  }

  return { deletedIds, blocked };
}

// Each department is checked on its own, so some can be restored while others are blocked.
export async function restoreDepartments(ids: string[]): Promise<DepartmentBulkRestoreResult> {
  const access = await requireDepartmentManager();

  const restoredIds: string[] = [];
  const blocked: DepartmentBulkRestoreResult["blocked"] = [];

  for (const id of ids) {
    const result = await restoreOne(id, access);

    if (result.ok) {
      restoredIds.push(id);
    } else {
      blocked.push({
        id,
        formError: result.formError ?? DEPARTMENT_NOT_FOUND_MESSAGE,
      });
    }
  }

  if (restoredIds.length > 0) {
    revalidatePath(DEPARTMENTS_PATH);
  }

  return { restoredIds, blocked };
}
