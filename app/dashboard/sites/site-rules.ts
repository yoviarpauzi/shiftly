export type SiteActionResult =
  | { ok: true }
  | { ok: false; fieldErrors?: { name?: string }; formError?: string };

export const DUPLICATE_NAME_MESSAGE = "A site with this name already exists";

export const SITE_NOT_FOUND_MESSAGE = "This site no longer exists";

const SITE_NAME_CONSTRAINT = "site_name_lower_active_unique";

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function canDeleteSite({
  activeLocations,
  assignedUsers,
}: {
  activeLocations: number;
  assignedUsers: number;
}): { ok: true } | { ok: false; formError: string } {
  if (activeLocations === 0 && assignedUsers === 0) {
    return { ok: true };
  }

  const blockers: string[] = [];

  if (activeLocations > 0) {
    blockers.push(plural(activeLocations, "active location", "active locations"));
  }

  if (assignedUsers > 0) {
    blockers.push(plural(assignedUsers, "HO user assigned", "HO users assigned"));
  }

  return {
    ok: false,
    formError: `This site has ${blockers.join(" and ")}. Move them first.`,
  };
}

function hasNameConflictCode(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const { code, constraint } = value as { code?: unknown; constraint?: unknown };

  return code === "23505" && constraint === SITE_NAME_CONSTRAINT;
}

// Drizzle wraps driver errors, so the PostgreSQL error can sit on `cause`.
export function isSiteNameConflict(error: unknown) {
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

// TanStack Form reads field errors as { message } objects, the shape zod issues have.
// A bare string renders nothing in FieldError, so the message is wrapped here.
export function nameFieldError(message: string | undefined) {
  return message ? { message } : undefined;
}

export type SiteBulkDeleteResult = {
  deletedIds: string[];
  blocked: { id: string; formError: string }[];
};

function sitesWord(count: number) {
  return count === 1 ? "site" : "sites";
}

// Summary shown after a bulk delete. Each site is checked on its own, so some can succeed while others are blocked.
export function bulkDeleteMessage(deleted: number, blocked: number) {
  if (blocked === 0) {
    return `${deleted} ${sitesWord(deleted)} deleted`;
  }

  if (deleted === 0) {
    return `${blocked} ${sitesWord(blocked)} could not be deleted`;
  }

  return `${deleted} ${sitesWord(deleted)} deleted, ${blocked} could not be deleted`;
}

export const SITE_STATUSES = ["active", "deleted", "all"] as const;

export type SiteStatus = (typeof SITE_STATUSES)[number];

// Reads the status filter from the URL. Anything unknown falls back to active sites.
export function parseSiteStatus(value: string | string[] | undefined): SiteStatus {
  const first = Array.isArray(value) ? value[0] : value;

  return (SITE_STATUSES as readonly string[]).includes(first ?? "")
    ? (first as SiteStatus)
    : "active";
}
