"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { department, subDepartment } from "@/database/schema/department-schema";
import { db } from "@/lib/db";
import type { DepartmentAccess, SubDepartmentActionResult } from "@/types/departments";
import { subDepartmentSchema, type SubDepartmentInput } from "@/validation/sub-department";
import { requireDepartmentManager } from "./department-guard";
import {
  canRestoreSubDepartment,
  DEPARTMENT_NOT_FOUND_MESSAGE,
  DUPLICATE_SUB_DEPARTMENT_NAME_MESSAGE,
  isSubDepartmentNameConflict,
  SUB_DEPARTMENT_NOT_FOUND_MESSAGE,
  SUB_DEPARTMENT_RESTORE_CONFLICT_MESSAGE,
} from "./department-rules";
import { departmentScopeFilter } from "./departments";

const DEPARTMENTS_PATH = "/dashboard/departments";

function revalidateDepartment(departmentId: string) {
  revalidatePath(`${DEPARTMENTS_PATH}/${departmentId}`);
  revalidatePath(DEPARTMENTS_PATH);
}

// Parent-scope condition for a sub-department's own where clause: its department is in scope and active.
// The lock query below already proved this. Repeating it on the write means an out-of-scope child matches nothing.
function parentInScope(access: DepartmentAccess) {
  return inArray(
    subDepartment.departmentId,
    db
      .select({ id: department.id })
      .from(department)
      .where(and(isNull(department.deletedAt), departmentScopeFilter(access))),
  );
}

// The department row is locked FOR SHARE for the rest of the transaction. A department delete takes FOR UPDATE,
// so it waits for this write, and this write sees its deleted_at after it commits.
export async function createSubDepartment(
  departmentId: string,
  input: SubDepartmentInput,
): Promise<SubDepartmentActionResult> {
  const access = await requireDepartmentManager();

  const parsed = subDepartmentSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, fieldErrors: { name: parsed.error.issues[0].message } };
  }

  let result: SubDepartmentActionResult;

  try {
    result = await db.transaction(async (tx): Promise<SubDepartmentActionResult> => {
      const [parent] = await tx
        .select({ id: department.id })
        .from(department)
        .where(
          and(
            eq(department.id, departmentId),
            isNull(department.deletedAt),
            departmentScopeFilter(access),
          ),
        )
        .for("share");

      if (!parent) {
        return { ok: false, formError: DEPARTMENT_NOT_FOUND_MESSAGE };
      }

      await tx.insert(subDepartment).values({
        name: parsed.data.name,
        departmentId: parent.id,
      });

      return { ok: true };
    });
  } catch (error) {
    if (isSubDepartmentNameConflict(error)) {
      return { ok: false, fieldErrors: { name: DUPLICATE_SUB_DEPARTMENT_NAME_MESSAGE } };
    }

    throw error;
  }

  if (result.ok) {
    revalidateDepartment(departmentId);
  }

  return result;
}

export async function updateSubDepartment(
  id: string,
  input: SubDepartmentInput,
): Promise<SubDepartmentActionResult> {
  const access = await requireDepartmentManager();

  const parsed = subDepartmentSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, fieldErrors: { name: parsed.error.issues[0].message } };
  }

  let departmentId: string | undefined;
  let result: SubDepartmentActionResult;

  try {
    result = await db.transaction(async (tx): Promise<SubDepartmentActionResult> => {
      // Locks the parent only (of: department). The child is read through the join so its parent is the one checked.
      const [target] = await tx
        .select({ id: subDepartment.id, departmentId: department.id })
        .from(subDepartment)
        .innerJoin(department, eq(department.id, subDepartment.departmentId))
        .where(
          and(
            eq(subDepartment.id, id),
            isNull(subDepartment.deletedAt),
            isNull(department.deletedAt),
            departmentScopeFilter(access),
          ),
        )
        .for("share", { of: department });

      if (!target) {
        return { ok: false, formError: SUB_DEPARTMENT_NOT_FOUND_MESSAGE };
      }

      departmentId = target.departmentId;

      const updated = await tx
        .update(subDepartment)
        .set({ name: parsed.data.name })
        .where(
          and(
            eq(subDepartment.id, target.id),
            isNull(subDepartment.deletedAt),
            parentInScope(access),
          ),
        )
        .returning({ id: subDepartment.id });

      if (updated.length === 0) {
        return { ok: false, formError: SUB_DEPARTMENT_NOT_FOUND_MESSAGE };
      }

      return { ok: true };
    });
  } catch (error) {
    if (isSubDepartmentNameConflict(error)) {
      return { ok: false, fieldErrors: { name: DUPLICATE_SUB_DEPARTMENT_NAME_MESSAGE } };
    }

    throw error;
  }

  if (result.ok && departmentId) {
    revalidateDepartment(departmentId);
  }

  return result;
}

// Always allowed while the sub-department and its department are in scope. Soft delete only.
export async function deleteSubDepartment(id: string): Promise<SubDepartmentActionResult> {
  const access = await requireDepartmentManager();

  let departmentId: string | undefined;

  const result = await db.transaction(async (tx): Promise<SubDepartmentActionResult> => {
    const [target] = await tx
      .select({ id: subDepartment.id, departmentId: department.id })
      .from(subDepartment)
      .innerJoin(department, eq(department.id, subDepartment.departmentId))
      .where(
        and(
          eq(subDepartment.id, id),
          isNull(subDepartment.deletedAt),
          isNull(department.deletedAt),
          departmentScopeFilter(access),
        ),
      )
      .for("share", { of: department });

    if (!target) {
      return { ok: false, formError: SUB_DEPARTMENT_NOT_FOUND_MESSAGE };
    }

    departmentId = target.departmentId;

    const deleted = await tx
      .update(subDepartment)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(subDepartment.id, target.id),
          isNull(subDepartment.deletedAt),
          parentInScope(access),
        ),
      )
      .returning({ id: subDepartment.id });

    if (deleted.length === 0) {
      return { ok: false, formError: SUB_DEPARTMENT_NOT_FOUND_MESSAGE };
    }

    return { ok: true };
  });

  if (result.ok && departmentId) {
    revalidateDepartment(departmentId);
  }

  return result;
}

export async function restoreSubDepartment(id: string): Promise<SubDepartmentActionResult> {
  const access = await requireDepartmentManager();

  let departmentId: string | undefined;
  let result: SubDepartmentActionResult;

  try {
    result = await db.transaction(async (tx): Promise<SubDepartmentActionResult> => {
      // The department is read in any state, so its real deleted_at reaches canRestoreSubDepartment.
      // The FOR SHARE lock keeps that state stable until the sub-department is written.
      const [target] = await tx
        .select({
          id: subDepartment.id,
          departmentId: department.id,
          departmentDeletedAt: department.deletedAt,
        })
        .from(subDepartment)
        .innerJoin(department, eq(department.id, subDepartment.departmentId))
        .where(
          and(
            eq(subDepartment.id, id),
            isNotNull(subDepartment.deletedAt),
            departmentScopeFilter(access),
          ),
        )
        .for("share", { of: department });

      if (!target) {
        return { ok: false, formError: SUB_DEPARTMENT_NOT_FOUND_MESSAGE };
      }

      const verdict = canRestoreSubDepartment({
        departmentDeleted: target.departmentDeletedAt !== null,
      });

      if (!verdict.ok) {
        return { ok: false, formError: verdict.formError };
      }

      departmentId = target.departmentId;

      const restored = await tx
        .update(subDepartment)
        .set({ deletedAt: null })
        .where(
          and(
            eq(subDepartment.id, target.id),
            isNotNull(subDepartment.deletedAt),
            parentInScope(access),
          ),
        )
        .returning({ id: subDepartment.id });

      if (restored.length === 0) {
        return { ok: false, formError: SUB_DEPARTMENT_NOT_FOUND_MESSAGE };
      }

      return { ok: true };
    });
  } catch (error) {
    if (isSubDepartmentNameConflict(error)) {
      return { ok: false, formError: SUB_DEPARTMENT_RESTORE_CONFLICT_MESSAGE };
    }

    throw error;
  }

  if (result.ok && departmentId) {
    revalidateDepartment(departmentId);
  }

  return result;
}
