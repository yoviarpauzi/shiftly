import type {
  RequestChoices,
  RequestDetail,
  RequestFieldErrors,
  RequestFormFieldErrors,
  RequestFormLine,
  RequestFormValues,
  RequestLineInput,
  RequestOption,
  RequestStatus,
  RequestType,
} from "@/types/requests";
import { statusAfterEdit } from "./request-rules";

// Matches the max in the lines schema.
export const MAX_REQUEST_LINES = 50;

const DAYS_IN_WEEK = 7;

function sevenOf(value: number): number[] {
  return Array.from({ length: DAYS_IN_WEEK }, () => value);
}

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

export function blankLine(): RequestFormLine {
  return {
    departmentId: "",
    subDepartmentId: null,
    positionId: "",
    headcount: Number.NaN,
    perDay: false,
    dayHeadcounts: sevenOf(Number.NaN),
  };
}

// The form mode is not stored. Seven numbers that are not all equal open per day, with the first
// number above 0 as the single number; anything else opens as one number.
export function formLineFromInput(line: RequestLineInput): RequestFormLine {
  const { headcounts } = line;
  const perDay =
    headcounts.length === DAYS_IN_WEEK && headcounts.some((value) => value !== headcounts[0]);

  return {
    departmentId: line.departmentId,
    subDepartmentId: line.subDepartmentId,
    positionId: line.positionId,
    headcount: perDay
      ? (headcounts.find((value) => value > 0) ?? Number.NaN)
      : (headcounts[0] ?? Number.NaN),
    perDay,
    dayHeadcounts:
      headcounts.length === DAYS_IN_WEEK ? [...headcounts] : sevenOf(Number.NaN),
  };
}

// Turning per day on starts every day from the single number. Turning it off keeps the day numbers
// in the state, but toRequestLineInputs ignores them while it is off.
export function lineAfterPerDayToggle(line: RequestFormLine, perDay: boolean): RequestFormLine {
  return perDay
    ? { ...line, perDay, dayHeadcounts: sevenOf(line.headcount) }
    : { ...line, perDay };
}

export function lineAfterDayChange(
  line: RequestFormLine,
  dayIndex: number,
  value: number,
): RequestFormLine {
  return {
    ...line,
    dayHeadcounts: line.dayHeadcounts.map((day, index) => (index === dayIndex ? value : day)),
  };
}

// Daily (or a type not chosen yet) sends [n]. Weekly sends the seven day numbers when per day is
// on, or the single number seven times. Empty numbers stay NaN so the schema reports them.
function lineHeadcounts(type: RequestType | "", line: RequestFormLine): number[] {
  if (type !== "weekly") {
    return [line.headcount];
  }

  return line.perDay ? [...line.dayHeadcounts] : sevenOf(line.headcount);
}

export function toRequestLineInputs(
  type: RequestType | "",
  lines: RequestFormLine[],
): RequestLineInput[] {
  return lines.map((line) => ({
    departmentId: line.departmentId,
    subDepartmentId: line.subDepartmentId,
    positionId: line.positionId,
    headcounts: lineHeadcounts(type, line),
  }));
}

// Departments and positions depend on the location, so a new location starts the lines over.
export function linesAfterLocationChange(): RequestFormLine[] {
  return [blankLine()];
}

// The locations depend on the site, so a new site clears the location and starts the lines over.
export function afterSiteChange(
  choices: RequestChoices,
  siteId: string,
): { locationId: string; lines: RequestFormLine[] } {
  return { locationId: onlyLocationId(choices, siteId), lines: linesAfterLocationChange() };
}

// A sub-department belongs to one department, so a new department clears it.
export function lineAfterDepartmentChange(
  line: RequestFormLine,
  departmentId: string,
): RequestFormLine {
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
      lines: request.lines.map(formLineFromInput),
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

export const SITE_REQUIRED_MESSAGE = "Choose a site";

// With no site chosen the location select is disabled, so its error would sit under a field the
// user cannot use. When the site picker shows, that error moves onto the site. A fixed-text site
// has no place for an error, so nothing moves then.
export function withSiteError(
  errors: RequestFieldErrors,
  siteId: string,
  pickSite: boolean,
): RequestFormFieldErrors {
  if (!pickSite || siteId !== "" || !errors.locationId) {
    return errors;
  }

  const moved: RequestFormFieldErrors = { ...errors, siteId: SITE_REQUIRED_MESSAGE };

  delete moved.locationId;

  return moved;
}

export function returnsToPending(request: Pick<RequestDetail, "type" | "status">): boolean {
  return request.status === "approved" && statusAfterEdit(request.type, request.status) === "pending";
}

export function isReadOnlyStatus(status: RequestStatus): boolean {
  return statusAfterEdit("daily", status) === null;
}
