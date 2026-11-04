import type { ShiftField, ShiftFieldErrors, ShiftLocationOption } from "@/types/shifts";

export const SHIFT_NOT_FOUND_MESSAGE = "Shift not found";

export const LOCATION_NOT_FOUND_MESSAGE = "Location not found";

export const LOCATION_DELETED_MESSAGE = "Restore the location first";

export const DUPLICATE_SHIFT_ORDER_MESSAGE = "Order is already used in this location";

export const DUPLICATE_SHIFT_NAME_MESSAGE = "Name is already used in this location";

export const SHIFT_IN_USE_MESSAGE = "This shift is used by a pending or approved request";

export const SHIFT_RESTORE_CONFLICT_MESSAGE =
  "Another active shift in this location already uses this order or name. Change that shift before restoring.";

const SHIFT_ORDER_CONSTRAINT = "shift_locationId_order_active_unique";

const SHIFT_NAME_CONSTRAINT = "shift_locationId_lowerName_active_unique";

// Requests that are pending or approved still ask for the shift, so it cannot go. Rejected and
// cancelled requests no longer do. requestStatuses are the statuses of every request whose lines
// use the shift.
export function canDeleteShift({
  requestStatuses,
}: {
  requestStatuses: string[];
}): { ok: true } | { ok: false; formError: string } {
  const inUse = requestStatuses.some((status) => status === "pending" || status === "approved");

  return inUse ? { ok: false, formError: SHIFT_IN_USE_MESSAGE } : { ok: true };
}

// A shift lives under a location, so it cannot come back while that location is deleted.
export function canRestoreShift({
  locationDeleted,
}: {
  locationDeleted: boolean;
}): { ok: true } | { ok: false; formError: string } {
  return locationDeleted ? { ok: false, formError: LOCATION_DELETED_MESSAGE } : { ok: true };
}

// A location name alone can repeat across sites, so the label leads with the site.
export function shiftLocationLabel(option: ShiftLocationOption): string {
  return `${option.siteName} / ${option.name}`;
}

function conflictFieldOf(value: unknown): "order" | "name" | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const { code, constraint } = value as { code?: unknown; constraint?: unknown };

  if (code !== "23505") {
    return null;
  }

  if (constraint === SHIFT_ORDER_CONSTRAINT) {
    return "order";
  }

  return constraint === SHIFT_NAME_CONSTRAINT ? "name" : null;
}

// Which field a unique violation is about, or null when the error is something else. The name index
// is on lower(name), so a name that matches an active sibling only in case also conflicts.
// Drizzle wraps driver errors, so the PostgreSQL error can sit on `cause`.
export function shiftConflictField(error: unknown): "order" | "name" | null {
  const direct = conflictFieldOf(error);

  if (direct) {
    return direct;
  }

  return typeof error === "object" && error !== null && "cause" in error
    ? conflictFieldOf(error.cause)
    : null;
}

// Keeps the first message for each field, so a form shows one error per field.
export function shiftFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): ShiftFieldErrors {
  const errors: ShiftFieldErrors = {};

  for (const issue of issues) {
    const field = String(issue.path[0]) as ShiftField;

    errors[field] ??= issue.message;
  }

  return errors;
}

// PostgreSQL returns time as HH:MM:SS. The app shows and edits HH:MM.
export function toHourMinute(time: string): string {
  return time.slice(0, 5);
}

export function formatShiftRange(startTime: string, endTime: string): string {
  return `${toHourMinute(startTime)} - ${toHourMinute(endTime)}`;
}

function shiftsWord(count: number) {
  return count === 1 ? "shift" : "shifts";
}

function bulkSummary(verb: "deleted" | "restored", done: number, blocked: number) {
  if (blocked === 0) {
    return `${done} ${shiftsWord(done)} ${verb}`;
  }

  if (done === 0) {
    return `${blocked} ${shiftsWord(blocked)} could not be ${verb}`;
  }

  return `${done} ${shiftsWord(done)} ${verb}, ${blocked} ${shiftsWord(blocked)} could not be ${verb}`;
}

// Summary shown after a bulk delete. Each shift is checked on its own, so some can succeed while others are blocked.
export function bulkShiftDeleteMessage(deleted: number, blocked: number) {
  return bulkSummary("deleted", deleted, blocked);
}

// Summary shown after a bulk restore. Same rule as a bulk delete.
export function bulkShiftRestoreMessage(restored: number, blocked: number) {
  return bulkSummary("restored", restored, blocked);
}
