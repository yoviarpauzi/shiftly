import type {
  RequestFieldErrors,
  RequestLineInput,
  RequestStatus,
  RequestType,
} from "@/types/requests";

export const REQUEST_NOT_FOUND_MESSAGE = "Request not found";

// Shown by a client component when a request action throws instead of returning a result.
export const ACTION_FAILED_MESSAGE = "Something went wrong. Try again.";

export const LOCATION_NOT_FOUND_MESSAGE = "Location not found";

export function siteCodeMissingMessage(siteName: string): string {
  return `${siteName} has no code yet. Add a code to the site before creating requests.`;
}

export const NOT_PENDING_MESSAGE = "Only a pending request can be approved or rejected";

export const NOT_EDITABLE_MESSAGE = "A rejected or cancelled request cannot be edited";

export const NOT_CANCELLABLE_MESSAGE = "Only a pending or approved request can be cancelled";

// Covers both an empty and an over-long reason.
export const REASON_REQUIRED_MESSAGE = "Enter a reason of up to 500 characters";

const UNKNOWN_DEPARTMENT_MESSAGE = "Choose a department from this location";

const UNKNOWN_SUB_DEPARTMENT_MESSAGE = "Choose a sub-department of the selected department";

const UNKNOWN_POSITION_MESSAGE = "Choose a position from this site";

const WEEK_LAST_DAY_OFFSET = 6;

// A daily request is approved on save. A weekly request waits for HO.
export function initialStatus(type: RequestType): "approved" | "pending" {
  return type === "weekly" ? "pending" : "approved";
}

// The status a request takes after an edit, or null when it cannot be edited. Editing an approved
// weekly request sends it back to pending so the approval always covers the current content.
export function statusAfterEdit(
  type: RequestType,
  status: RequestStatus,
): RequestStatus | null {
  if (status === "pending") {
    return "pending";
  }

  if (status === "approved") {
    return type === "weekly" ? "pending" : "approved";
  }

  return null;
}

export function canCancelRequest(status: RequestStatus): boolean {
  return status === "pending" || status === "approved";
}

export function canDecideStatus(status: RequestStatus): boolean {
  return status === "pending";
}

// startDate is YYYY-MM-DD. Date.UTC keeps the week arithmetic independent of the server time zone.
export function formatRequestDates(type: RequestType, startDate: string): string {
  if (type === "daily") {
    return startDate;
  }

  const [year, month, day] = startDate.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1, day + WEEK_LAST_DAY_OFFSET));

  return `${startDate} - ${end.toISOString().slice(0, 10)}`;
}

// Checks every line against the choices the actor may use: departments of the location (with their
// sub-departments) and positions of the site. Returns the first problem, or null when all is valid.
export function lineScopeError(
  lines: RequestLineInput[],
  valid: { departments: Map<string, Set<string>>; positionIds: Set<string> },
): string | null {
  for (const line of lines) {
    const subDepartmentIds = valid.departments.get(line.departmentId);

    if (!subDepartmentIds) {
      return UNKNOWN_DEPARTMENT_MESSAGE;
    }

    if (line.subDepartmentId !== null && !subDepartmentIds.has(line.subDepartmentId)) {
      return UNKNOWN_SUB_DEPARTMENT_MESSAGE;
    }

    if (!valid.positionIds.has(line.positionId)) {
      return UNKNOWN_POSITION_MESSAGE;
    }
  }

  return null;
}

// Keeps the first message for each field, so a form shows one error per field.
export function requestFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): RequestFieldErrors {
  const errors: RequestFieldErrors = {};

  for (const issue of issues) {
    const field = String(issue.path[0]) as keyof RequestFieldErrors;

    errors[field] ??= issue.message;
  }

  return errors;
}

// Superadmin picks a site first, so until then there are no locations to filter by. HO has one
// site, so its locations are listed as they are.
export function requestLocationsFor(
  locations: { id: string; name: string; siteId: string }[],
  siteId: string | null,
  pickSite: boolean,
): { id: string; name: string; siteId: string }[] {
  if (pickSite && !siteId) {
    return [];
  }

  return locations.filter((location) => !siteId || location.siteId === siteId);
}
