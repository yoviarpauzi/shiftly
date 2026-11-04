import type {
  BulkSelectionMode,
  LocationFieldErrors,
  LocationRow,
} from "@/types/locations";

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
  activeWorkers,
  activeShifts,
}: {
  assignedAdminSites: number;
  activeDepartments: number;
  activeWorkers: number;
  activeShifts: number;
}): { ok: true } | { ok: false; formError: string } {
  if (
    assignedAdminSites === 0 &&
    activeDepartments === 0 &&
    activeWorkers === 0 &&
    activeShifts === 0
  ) {
    return { ok: true };
  }

  const blockers: string[] = [];

  if (assignedAdminSites > 0) {
    blockers.push(plural(assignedAdminSites, "admin site user assigned", "admin site users assigned"));
  }

  if (activeWorkers > 0) {
    blockers.push(plural(activeWorkers, "active worker", "active workers"));
  }

  if (activeDepartments > 0) {
    blockers.push(plural(activeDepartments, "active department", "active departments"));
  }

  if (activeShifts > 0) {
    blockers.push(plural(activeShifts, "active shift", "active shifts"));
  }

  // Users and workers can be moved to another location, but departments and shifts cannot, so they have to be deleted.
  const movable = [
    assignedAdminSites > 0 ? "users" : null,
    activeWorkers > 0 ? "workers" : null,
  ].filter((label) => label !== null);
  const deletable = [
    activeDepartments > 0 ? "departments" : null,
    activeShifts > 0 ? "shifts" : null,
  ].filter((label) => label !== null);
  let action = `Move the ${movable.join(" and ")} and delete the ${deletable.join(" and ")} first.`;

  if (deletable.length === 0) {
    action = "Move them first.";
  } else if (movable.length === 0) {
    action = activeDepartments + activeShifts === 1 ? "Delete it first." : "Delete them first.";
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

// Keeps the first message for each field, so a form shows one error per field.
export function locationFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): LocationFieldErrors {
  const errors: LocationFieldErrors = {};

  for (const issue of issues) {
    const field = String(issue.path[0]) as keyof LocationFieldErrors;

    errors[field] ??= issue.message;
  }

  return errors;
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
