import type {
  RequestChoices,
  RequestDetail,
  RequestFormValues,
  RequestLineInput,
  RequestOption,
  RequestStatus,
} from "@/types/requests";
import { statusAfterEdit } from "./request-rules";

// Matches the max in the lines schema.
export const MAX_REQUEST_LINES = 50;

function toOption({ id, name }: RequestOption): RequestOption {
  return { id, name };
}

export function locationsFor(choices: RequestChoices, siteId: string): RequestOption[] {
  return choices.locations.filter((row) => row.siteId === siteId).map(toOption);
}

// A site with one location needs no choice, so the form starts on it.
function onlyLocationId(choices: RequestChoices, siteId: string): string {
  const inSite = locationsFor(choices, siteId);

  return inSite.length === 1 ? inSite[0].id : "";
}

export function departmentsFor(choices: RequestChoices, locationId: string): RequestOption[] {
  return choices.departments.filter((row) => row.locationId === locationId).map(toOption);
}

export function subDepartmentsFor(
  choices: RequestChoices,
  departmentId: string,
): RequestOption[] {
  return choices.subDepartments.filter((row) => row.departmentId === departmentId).map(toOption);
}

// Positions belong to a site, so the location's site decides which ones apply.
export function positionsFor(choices: RequestChoices, locationId: string): RequestOption[] {
  const siteId = choices.locations.find((row) => row.id === locationId)?.siteId;

  if (!siteId) {
    return [];
  }

  return choices.positions.filter((row) => row.siteId === siteId).map(toOption);
}

export function blankLine(): RequestLineInput {
  return { departmentId: "", subDepartmentId: null, positionId: "", headcount: Number.NaN };
}

// Departments and positions depend on the location, so a new location starts the lines over.
export function linesAfterLocationChange(): RequestLineInput[] {
  return [blankLine()];
}

// The locations depend on the site, so a new site clears the location and starts the lines over.
export function afterSiteChange(
  choices: RequestChoices,
  siteId: string,
): { locationId: string; lines: RequestLineInput[] } {
  return { locationId: onlyLocationId(choices, siteId), lines: linesAfterLocationChange() };
}

// A sub-department belongs to one department, so a new department clears it.
export function lineAfterDepartmentChange(
  line: RequestLineInput,
  departmentId: string,
): RequestLineInput {
  return { ...line, departmentId, subDepartmentId: null };
}

export function canAddLine(count: number): boolean {
  return count < MAX_REQUEST_LINES;
}

export function canRemoveLine(count: number): boolean {
  return count > 1;
}

// An actor with a single site starts on it, and a site with a single location starts on that, so
// HO and admin site never have to choose what they have no choice about.
export function requestFormDefaults(
  request: RequestDetail | null,
  choices: RequestChoices,
): RequestFormValues {
  if (request) {
    return {
      type: request.type,
      startDate: request.startDate,
      siteId: request.siteId,
      locationId: request.locationId,
      lines: request.lines,
    };
  }

  const siteId = choices.sites.length === 1 ? choices.sites[0].id : "";

  return {
    type: "",
    startDate: "",
    siteId,
    locationId: onlyLocationId(choices, siteId),
    lines: [blankLine()],
  };
}

export function returnsToPending(request: Pick<RequestDetail, "type" | "status">): boolean {
  return request.status === "approved" && statusAfterEdit(request.type, request.status) === "pending";
}

export function isReadOnlyStatus(status: RequestStatus): boolean {
  return statusAfterEdit("daily", status) === null;
}
