export const WORKER_NOT_FOUND_MESSAGE = "Worker not found";

export const SITE_NOT_FOUND_MESSAGE = "Site not found";

export const LOCATION_NOT_FOUND_MESSAGE = "Location not found in this site";

export const POSITIONS_NOT_FOUND_MESSAGE = "Some positions are not available in this site";

export const DUPLICATE_EMPLOYEE_ID_MESSAGE = "Employee ID is already used by another worker";

export const WORKER_RESTORE_CONFLICT_MESSAGE =
  "Another active worker already uses this employee ID. Change it before restoring.";

export const SITE_DELETED_MESSAGE = "Restore the site first";

export const LOCATION_DELETED_MESSAGE = "Restore the location first";

const EMPLOYEE_ID_CONSTRAINT = "worker_lowerEmployeeId_active_unique";

// A worker lives under a site and a location, so it cannot come back while either is deleted.
export function canRestoreWorker({
  siteDeleted,
  locationDeleted,
}: {
  siteDeleted: boolean;
  locationDeleted: boolean;
}): { ok: true } | { ok: false; formError: string } {
  if (siteDeleted) {
    return { ok: false, formError: SITE_DELETED_MESSAGE };
  }

  return locationDeleted ? { ok: false, formError: LOCATION_DELETED_MESSAGE } : { ok: true };
}

function hasEmployeeIdConflictCode(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const { code, constraint } = value as { code?: unknown; constraint?: unknown };

  return code === "23505" && constraint === EMPLOYEE_ID_CONSTRAINT;
}

// The index is on lower(employee_id), so an ID that matches an active worker only in case also conflicts.
// Drizzle wraps driver errors, so the PostgreSQL error can sit on `cause`.
export function isEmployeeIdConflict(error: unknown) {
  if (hasEmployeeIdConflictCode(error)) {
    return true;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    hasEmployeeIdConflictCode(error.cause)
  );
}

function workersWord(count: number) {
  return count === 1 ? "worker" : "workers";
}

function bulkSummary(verb: "deleted" | "restored", done: number, blocked: number) {
  if (blocked === 0) {
    return `${done} ${workersWord(done)} ${verb}`;
  }

  if (done === 0) {
    return `${blocked} ${workersWord(blocked)} could not be ${verb}`;
  }

  return `${done} ${workersWord(done)} ${verb}, ${blocked} could not be ${verb}`;
}

// Summary shown after a bulk delete. Each worker is checked on its own, so some can succeed while others are blocked.
export function bulkWorkerDeleteMessage(deleted: number, blocked: number) {
  return bulkSummary("deleted", deleted, blocked);
}

// Summary shown after a bulk restore. Same rule as a bulk delete.
export function bulkWorkerRestoreMessage(restored: number, blocked: number) {
  return bulkSummary("restored", restored, blocked);
}
