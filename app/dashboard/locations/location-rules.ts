import type { BulkSelectionMode, LocationRow } from "@/types/locations";

export const DUPLICATE_NAME_MESSAGE = "Name is already used in this site";

export const LOCATION_NOT_FOUND_MESSAGE = "Location not found";

export const RESTORE_CONFLICT_MESSAGE =
  "Another active location in this site already uses this name. Rename it before restoring.";

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function canDeleteLocation({
  assignedAdminSites,
  activeDepartments,
}: {
  assignedAdminSites: number;
  activeDepartments: number;
}): { ok: true } | { ok: false; formError: string } {
  if (assignedAdminSites === 0 && activeDepartments === 0) {
    return { ok: true };
  }

  const blockers: string[] = [];

  if (assignedAdminSites > 0) {
    blockers.push(plural(assignedAdminSites, "admin site user assigned", "admin site users assigned"));
  }

  if (activeDepartments > 0) {
    blockers.push(plural(activeDepartments, "active department", "active departments"));
  }

  // Users can be moved to another location, but a department cannot, so it has to be deleted.
  let action = "Move the users and delete the departments first.";

  if (activeDepartments === 0) {
    action = "Move them first.";
  } else if (assignedAdminSites === 0) {
    action = activeDepartments === 1 ? "Delete it first." : "Delete them first.";
  }

  return {
    ok: false,
    formError: `This location has ${blockers.join(" and ")}. ${action}`,
  };
}

// TanStack Form reads field errors as { message } objects, the shape zod issues have.
// A bare string renders nothing in FieldError, so the message is wrapped here.
export function nameFieldError(message: string | undefined) {
  return message ? { message } : undefined;
}

function locationsWord(count: number) {
  return count === 1 ? "location" : "locations";
}

function bulkSummary(verb: "deleted" | "restored", done: number, blocked: number) {
  if (blocked === 0) {
    return `${done} ${locationsWord(done)} ${verb}`;
  }

  if (done === 0) {
    return `${blocked} ${locationsWord(blocked)} could not be ${verb}`;
  }

  return `${done} ${locationsWord(done)} ${verb}, ${blocked} could not be ${verb}`;
}

// Summary shown after a bulk delete. Each location is checked on its own, so some can succeed while others are blocked.
export function bulkDeleteMessage(deleted: number, blocked: number) {
  return bulkSummary("deleted", deleted, blocked);
}

// Summary shown after a bulk restore. Same rule as a bulk delete: some can succeed while others are blocked.
export function bulkRestoreMessage(restored: number, blocked: number) {
  return bulkSummary("restored", restored, blocked);
}

// Active and deleted locations cannot be mixed, so the selection decides which bulk action is allowed.
export function bulkSelectionMode(selected: LocationRow[]): BulkSelectionMode {
  if (selected.length === 0) {
    return "none";
  }

  const deleted = selected.filter((location) => location.deletedAt !== null).length;

  if (deleted === 0) {
    return "active";
  }

  return deleted === selected.length ? "deleted" : "mixed";
}
