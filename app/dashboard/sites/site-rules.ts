import type { BulkSelectionMode, SiteRow } from "@/types/sites";

export const DUPLICATE_NAME_MESSAGE = "A site with this name already exists";

export const DUPLICATE_CODE_MESSAGE = "A site with this code already exists";

export const SITE_NOT_FOUND_MESSAGE = "This site no longer exists";

export const RESTORE_CONFLICT_MESSAGE =
  "Another active site already uses this name or code. Change it before restoring.";

const SITE_NAME_CONSTRAINT = "site_name_lower_active_unique";
const SITE_CODE_CONSTRAINT = "site_code_lower_active_unique";

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function canDeleteSite({
  activeLocations,
  activePositions,
  assignedUsers,
}: {
  activeLocations: number;
  activePositions: number;
  assignedUsers: number;
}): { ok: true } | { ok: false; formError: string } {
  if (activeLocations === 0 && activePositions === 0 && assignedUsers === 0) {
    return { ok: true };
  }

  const blockers: string[] = [];

  if (activeLocations > 0) {
    blockers.push(plural(activeLocations, "active location", "active locations"));
  }

  if (activePositions > 0) {
    blockers.push(plural(activePositions, "active position", "active positions"));
  }

  if (assignedUsers > 0) {
    blockers.push(plural(assignedUsers, "HO user assigned", "HO users assigned"));
  }

  // "a", "a and b", "a, b and c".
  const list =
    blockers.length > 1
      ? `${blockers.slice(0, -1).join(", ")} and ${blockers[blockers.length - 1]}`
      : blockers[0];

  return {
    ok: false,
    formError: `This site has ${list}. Move or delete them first.`,
  };
}

function hasConstraintViolation(value: unknown, constraintName: string) {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const { code, constraint } = value as { code?: unknown; constraint?: unknown };

  return code === "23505" && constraint === constraintName;
}

// Drizzle wraps driver errors, so the PostgreSQL error can sit on `cause`.
function isConstraintConflict(error: unknown, constraintName: string) {
  if (hasConstraintViolation(error, constraintName)) {
    return true;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    hasConstraintViolation(error.cause, constraintName)
  );
}

export function isSiteNameConflict(error: unknown) {
  return isConstraintConflict(error, SITE_NAME_CONSTRAINT);
}

export function isSiteCodeConflict(error: unknown) {
  return isConstraintConflict(error, SITE_CODE_CONSTRAINT);
}

// TanStack Form reads field errors as { message } objects, the shape zod issues have.
// A bare string renders nothing in FieldError, so the message is wrapped here.
export function nameFieldError(message: string | undefined) {
  return message ? { message } : undefined;
}

function sitesWord(count: number) {
  return count === 1 ? "site" : "sites";
}

function bulkSummary(verb: "deleted" | "restored", done: number, blocked: number) {
  if (blocked === 0) {
    return `${done} ${sitesWord(done)} ${verb}`;
  }

  if (done === 0) {
    return `${blocked} ${sitesWord(blocked)} could not be ${verb}`;
  }

  return `${done} ${sitesWord(done)} ${verb}, ${blocked} could not be ${verb}`;
}

// Summary shown after a bulk delete. Each site is checked on its own, so some can succeed while others are blocked.
export function bulkDeleteMessage(deleted: number, blocked: number) {
  return bulkSummary("deleted", deleted, blocked);
}

// Summary shown after a bulk restore. Same rule as a bulk delete: some can succeed while others are blocked.
export function bulkRestoreMessage(restored: number, blocked: number) {
  return bulkSummary("restored", restored, blocked);
}

// Active and deleted sites cannot be mixed, so the selection decides which bulk action is allowed.
export function bulkSelectionMode(selected: SiteRow[]): BulkSelectionMode {
  if (selected.length === 0) {
    return "none";
  }

  const deleted = selected.filter((site) => site.deletedAt !== null).length;

  if (deleted === 0) {
    return "active";
  }

  return deleted === selected.length ? "deleted" : "mixed";
}
