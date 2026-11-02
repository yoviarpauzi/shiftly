import type {
  BulkNoun,
  BulkSelectionMode,
  DepartmentLocationChoice,
  DepartmentLocationOption,
  SoftDeletable,
} from "@/types/departments";
import type { SiteOption } from "@/types/locations";

export const DEPARTMENT_NOT_FOUND_MESSAGE = "Department not found";

export const SUB_DEPARTMENT_NOT_FOUND_MESSAGE = "Sub-department not found";

export const DUPLICATE_DEPARTMENT_NAME_MESSAGE = "Name is already used in this location";

export const DUPLICATE_SUB_DEPARTMENT_NAME_MESSAGE = "Name is already used in this department";

export const DEPARTMENT_RESTORE_CONFLICT_MESSAGE =
  "Another active department in this location already uses this name. Rename it before restoring.";

export const SUB_DEPARTMENT_RESTORE_CONFLICT_MESSAGE =
  "Another active sub-department in this department already uses this name. Rename it before restoring.";

export const LOCATION_DELETED_MESSAGE = "Restore the location first";

export const DEPARTMENT_DELETED_MESSAGE = "Restore the department first";

const DEPARTMENT_NAME_CONSTRAINT = "department_locationId_lowerName_active_unique";

const SUB_DEPARTMENT_NAME_CONSTRAINT = "sub_department_departmentId_lowerName_active_unique";

export function canDeleteDepartment({
  activeSubDepartments,
}: {
  activeSubDepartments: number;
}): { ok: true } | { ok: false; formError: string } {
  if (activeSubDepartments === 0) {
    return { ok: true };
  }

  if (activeSubDepartments === 1) {
    return {
      ok: false,
      formError: "This department has 1 active sub-department. Delete it first.",
    };
  }

  return {
    ok: false,
    formError: `This department has ${activeSubDepartments} active sub-departments. Delete them first.`,
  };
}

// A department lives under a location, so it cannot come back while that location is deleted.
export function canRestoreDepartment({
  locationDeleted,
}: {
  locationDeleted: boolean;
}): { ok: true } | { ok: false; formError: string } {
  return locationDeleted ? { ok: false, formError: LOCATION_DELETED_MESSAGE } : { ok: true };
}

// A sub-department lives under a department, so it cannot come back while that department is deleted.
export function canRestoreSubDepartment({
  departmentDeleted,
}: {
  departmentDeleted: boolean;
}): { ok: true } | { ok: false; formError: string } {
  return departmentDeleted ? { ok: false, formError: DEPARTMENT_DELETED_MESSAGE } : { ok: true };
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

// The index is on lower(name), so a name that matches an active sibling only in case also conflicts.
export function isDepartmentNameConflict(error: unknown) {
  return isConstraintConflict(error, DEPARTMENT_NAME_CONSTRAINT);
}

export function isSubDepartmentNameConflict(error: unknown) {
  return isConstraintConflict(error, SUB_DEPARTMENT_NAME_CONSTRAINT);
}

// TanStack Form reads field errors as { message } objects, the shape zod issues have.
// A bare string renders nothing in FieldError, so the message is wrapped here.
export function nameFieldError(message: string | undefined) {
  return message ? { message } : undefined;
}

const DEPARTMENT_NOUN: BulkNoun = { singular: "department", plural: "departments" };

const SUB_DEPARTMENT_NOUN: BulkNoun = { singular: "sub-department", plural: "sub-departments" };

function bulkSummary(
  verb: "deleted" | "restored",
  done: number,
  blocked: number,
  noun: BulkNoun,
) {
  const word = (count: number) => (count === 1 ? noun.singular : noun.plural);

  if (blocked === 0) {
    return `${done} ${word(done)} ${verb}`;
  }

  if (done === 0) {
    return `${blocked} ${word(blocked)} could not be ${verb}`;
  }

  return `${done} ${word(done)} ${verb}, ${blocked} could not be ${verb}`;
}

// Summary shown after a bulk delete. Each department is checked on its own, so some can succeed while others are blocked.
export function bulkDeleteMessage(deleted: number, blocked: number) {
  return bulkSummary("deleted", deleted, blocked, DEPARTMENT_NOUN);
}

// Summary shown after a bulk restore. Same rule as a bulk delete: some can succeed while others are blocked.
export function bulkRestoreMessage(restored: number, blocked: number) {
  return bulkSummary("restored", restored, blocked, DEPARTMENT_NOUN);
}

export function bulkSubDepartmentDeleteMessage(deleted: number, blocked: number) {
  return bulkSummary("deleted", deleted, blocked, SUB_DEPARTMENT_NOUN);
}

export function bulkSubDepartmentRestoreMessage(restored: number, blocked: number) {
  return bulkSummary("restored", restored, blocked, SUB_DEPARTMENT_NOUN);
}

// Active and deleted rows cannot be mixed, so the selection decides which bulk action is allowed.
// Used for departments and sub-departments.
export function bulkSelectionMode<T extends SoftDeletable>(selected: T[]): BulkSelectionMode {
  if (selected.length === 0) {
    return "none";
  }

  const deleted = selected.filter((row) => row.deletedAt !== null).length;

  if (deleted === 0) {
    return "active";
  }

  return deleted === selected.length ? "deleted" : "mixed";
}

// The sites that own the locations the actor can pick, so the site filter never offers a site with nothing to show.
export function departmentSitesFrom(locations: DepartmentLocationOption[]): SiteOption[] {
  const sites = new Map<string, SiteOption>();

  for (const location of locations) {
    if (!sites.has(location.siteId)) {
      sites.set(location.siteId, { id: location.siteId, name: location.siteName });
    }
  }

  return [...sites.values()];
}

// The site the add form starts on: a fixed location's own site, or the only site a picker offers.
// An actor who can pick between several sites starts with none chosen.
export function departmentSiteDefault(choice: DepartmentLocationChoice): string {
  if (choice.mode === "fixed") {
    return choice.location.siteId;
  }

  const sites = departmentSitesFrom(choice.locations);

  return sites.length === 1 ? sites[0].id : "";
}

// A site with one location needs no choice, so the form starts on it. Otherwise the location is
// cleared, because the one chosen before may belong to another site.
export function departmentLocationAfterSiteChange(
  locations: DepartmentLocationOption[],
  siteId: string,
): string {
  const inSite = locations.filter((location) => location.siteId === siteId);

  return inSite.length === 1 ? inSite[0].id : "";
}

// Superadmin picks a site first, so until then there are no locations to filter by. HO has one site,
// so its locations are listed as they are.
export function departmentLocationsFor(
  locations: DepartmentLocationOption[],
  siteId: string | null,
  pickSite: boolean,
): DepartmentLocationOption[] {
  if (pickSite && !siteId) {
    return [];
  }

  return locations.filter((location) => !siteId || location.siteId === siteId);
}
