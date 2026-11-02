export const POSITION_NOT_FOUND_MESSAGE = "Position not found";

export const SITE_NOT_FOUND_MESSAGE = "Site not found";

export const DUPLICATE_POSITION_NAME_MESSAGE = "Name is already used in this site";

export const POSITION_RESTORE_CONFLICT_MESSAGE =
  "Another active position in this site already uses this name. Rename it before restoring.";

export const SITE_DELETED_MESSAGE = "Restore the site first";

const POSITION_NAME_CONSTRAINT = "position_siteId_lowerName_active_unique";

// A worker keeps its positions, so a position in use has to be removed from the workers first.
export function canDeletePosition({
  activeWorkers,
}: {
  activeWorkers: number;
}): { ok: true } | { ok: false; formError: string } {
  if (activeWorkers === 0) {
    return { ok: true };
  }

  const who = activeWorkers === 1 ? "1 active worker" : `${activeWorkers} active workers`;

  return {
    ok: false,
    formError: `This position is assigned to ${who}. Remove it from them first.`,
  };
}

// A position lives under a site, so it cannot come back while that site is deleted.
export function canRestorePosition({
  siteDeleted,
}: {
  siteDeleted: boolean;
}): { ok: true } | { ok: false; formError: string } {
  return siteDeleted ? { ok: false, formError: SITE_DELETED_MESSAGE } : { ok: true };
}

function hasNameConflictCode(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const { code, constraint } = value as { code?: unknown; constraint?: unknown };

  return code === "23505" && constraint === POSITION_NAME_CONSTRAINT;
}

// The index is on lower(name), so a name that matches an active sibling only in case also conflicts.
// Drizzle wraps driver errors, so the PostgreSQL error can sit on `cause`.
export function isPositionNameConflict(error: unknown) {
  if (hasNameConflictCode(error)) {
    return true;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    hasNameConflictCode(error.cause)
  );
}

function positionsWord(count: number) {
  return count === 1 ? "position" : "positions";
}

function bulkSummary(verb: "deleted" | "restored", done: number, blocked: number) {
  if (blocked === 0) {
    return `${done} ${positionsWord(done)} ${verb}`;
  }

  if (done === 0) {
    return `${blocked} ${positionsWord(blocked)} could not be ${verb}`;
  }

  return `${done} ${positionsWord(done)} ${verb}, ${blocked} could not be ${verb}`;
}

// Summary shown after a bulk delete. Each position is checked on its own, so some can succeed while others are blocked.
export function bulkPositionDeleteMessage(deleted: number, blocked: number) {
  return bulkSummary("deleted", deleted, blocked);
}

// Summary shown after a bulk restore. Same rule as a bulk delete.
export function bulkPositionRestoreMessage(restored: number, blocked: number) {
  return bulkSummary("restored", restored, blocked);
}
