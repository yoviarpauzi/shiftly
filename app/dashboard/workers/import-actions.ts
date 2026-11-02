"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql, TransactionRollbackError } from "drizzle-orm";
import { location } from "@/database/schema/location-schema";
import { position } from "@/database/schema/position-schema";
import { site } from "@/database/schema/site-schema";
import { worker } from "@/database/schema/worker-schema";
import { db } from "@/lib/db";
import type {
  ImportCommitResult,
  ImportLookups,
  ImportPreviewResult,
  ImportRawRow,
} from "@/types/worker-import";
import type { WorkerAccess } from "@/types/workers";
import {
  checkImportFileBytes,
  checkImportFileMeta,
} from "@/validation/worker-import";
import { requireWorkerManager } from "./worker-guard";
import { importEmployeeIds, resolveImportRows, summarizeImport } from "./worker-import";
import { readImportSheet } from "./worker-import-file";
import { isEmployeeIdConflict } from "./worker-rules";
import { replacePositions, type Transaction } from "./worker-write";
import { workerScopeFilter } from "./workers";

const WORKERS_PATH = "/dashboard/workers";

const CHANGED_DURING_IMPORT_MESSAGE =
  "A worker changed during the import. Review it and try again.";

const EMPLOYEE_ID_TAKEN_MESSAGE =
  "Another worker now uses one of these employee IDs. Review the file and try again.";

type Executor = typeof db | Transaction;

// Checks the upload and reads its rows. Preview and commit both start here, so neither trusts the other.
async function readUpload(
  formData: FormData,
): Promise<{ ok: true; rows: ImportRawRow[] } | { ok: false; formError: string }> {
  const file = formData.get("file");

  // FormData holds a string or a File, so this does not depend on which File class the decoder built.
  if (file === null || typeof file === "string") {
    return { ok: false, formError: "Choose an .xlsx file" };
  }

  const metaError = checkImportFileMeta(file);

  if (metaError) {
    return { ok: false, formError: metaError };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const bytesError = checkImportFileBytes(bytes);

  if (bytesError) {
    return { ok: false, formError: bytesError };
  }

  return readImportSheet(bytes);
}

// Active sites, locations, and positions limited to what the actor may write to, like workerFormOptionsFor,
// and every active worker whose employee ID is in the file. With lock the share locks conflict with the
// update locks a site, location, or position delete takes, so none of them can be deleted before the
// transaction ends.
async function loadImportLookups(
  executor: Executor,
  access: WorkerAccess,
  employeeIds: string[],
  lock: boolean,
): Promise<ImportLookups> {
  const sitesQuery = executor
    .select({ id: site.id, name: site.name })
    .from(site)
    .where(and(isNull(site.deletedAt), access.siteId ? eq(site.id, access.siteId) : undefined));
  const sites = await (lock ? sitesQuery.for("share") : sitesQuery);

  const locationsQuery = executor
    .select({ id: location.id, siteId: location.siteId, name: location.name })
    .from(location)
    .where(
      and(
        isNull(location.deletedAt),
        access.siteId ? eq(location.siteId, access.siteId) : undefined,
        access.locationId ? eq(location.id, access.locationId) : undefined,
      ),
    );
  const locations = await (lock ? locationsQuery.for("share") : locationsQuery);

  const positionsQuery = executor
    .select({ id: position.id, siteId: position.siteId, name: position.name })
    .from(position)
    .where(
      and(isNull(position.deletedAt), access.siteId ? eq(position.siteId, access.siteId) : undefined),
    );
  const positions = await (lock ? positionsQuery.for("share") : positionsQuery);

  const existing =
    employeeIds.length === 0
      ? []
      : await executor
          .select({
            id: worker.id,
            employeeId: worker.employeeId,
            siteId: worker.siteId,
            locationId: worker.locationId,
          })
          .from(worker)
          .where(
            and(
              isNull(worker.deletedAt),
              inArray(
                sql`lower(${worker.employeeId})`,
                employeeIds.map((id) => id.toLowerCase()),
              ),
            ),
          );

  return { sites, locations, positions, existing };
}

export async function previewWorkerImport(formData: FormData): Promise<ImportPreviewResult> {
  const access = await requireWorkerManager();
  const sheet = await readUpload(formData);

  if (!sheet.ok) {
    return sheet;
  }

  const lookups = await loadImportLookups(db, access, importEmployeeIds(sheet.rows), false);
  const rows = resolveImportRows(sheet.rows, lookups, access);

  return { ok: true, rows, summary: summarizeImport(rows) };
}

// The file is read and resolved again inside the transaction, with the lookups locked. Nothing is saved
// while any row is an error, and a failure part way rolls every row back.
export async function commitWorkerImport(formData: FormData): Promise<ImportCommitResult> {
  const access = await requireWorkerManager();
  const sheet = await readUpload(formData);

  if (!sheet.ok) {
    return { ok: false, formError: sheet.formError };
  }

  let result: ImportCommitResult;

  try {
    result = await db.transaction(async (tx): Promise<ImportCommitResult> => {
      const lookups = await loadImportLookups(tx, access, importEmployeeIds(sheet.rows), true);
      const rows = resolveImportRows(sheet.rows, lookups, access);
      const summary = summarizeImport(rows);

      if (summary.error > 0) {
        return { ok: false, preview: { rows, summary } };
      }

      for (const row of rows) {
        if (row.action === "error") {
          continue;
        }

        if (row.workerId === null) {
          const [created] = await tx
            .insert(worker)
            .values({
              employeeId: row.employeeId,
              name: row.name,
              siteId: row.siteId,
              locationId: row.locationId,
              endContract: row.endContract,
            })
            .returning({ id: worker.id });

          await replacePositions(tx, created.id, row.positionIds);
        } else {
          const updated = await tx
            .update(worker)
            .set({
              employeeId: row.employeeId,
              name: row.name,
              siteId: row.siteId,
              locationId: row.locationId,
              endContract: row.endContract,
            })
            .where(
              and(
                eq(worker.id, row.workerId),
                isNull(worker.deletedAt),
                workerScopeFilter(access),
              ),
            )
            .returning({ id: worker.id });

          if (updated.length === 0) {
            tx.rollback();
          }

          await replacePositions(tx, row.workerId, row.positionIds);
        }
      }

      return { ok: true, created: summary.create, updated: summary.update };
    });
  } catch (error) {
    if (error instanceof TransactionRollbackError) {
      return { ok: false, formError: CHANGED_DURING_IMPORT_MESSAGE };
    }

    if (isEmployeeIdConflict(error)) {
      return { ok: false, formError: EMPLOYEE_ID_TAKEN_MESSAGE };
    }

    throw error;
  }

  if (result.ok) {
    revalidatePath(WORKERS_PATH);
  }

  return result;
}
