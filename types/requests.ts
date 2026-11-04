import type { db } from "@/lib/db";
import type { SiteOption } from "@/types/locations";
import type { PageParams } from "@/types/pagination";
import type { SortCriterion } from "@/types/sort";
import type { LocationTimezone } from "@/validation/location";

export type RequestType = "daily" | "weekly";

export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type RequestStatusFilter = RequestStatus | "all";

export type RequestTypeFilter = RequestType | "all";

export type RequestSortColumn = "po" | "type" | "date" | "location" | "status";

export type RequestAccess = {
  // null means every site, or every location of the site, depending on the field.
  siteId: string | null;
  locationId: string | null;
};

export type RequestLineInput = {
  departmentId: string;
  subDepartmentId: string | null;
  positionId: string;
  // null is Any shift.
  shiftId: string | null;
  // One number for a daily request, seven for a weekly one. The index is the day offset from the
  // start date.
  headcounts: number[];
};

export type RequestRow = {
  id: string;
  poNumber: string;
  type: RequestType;
  // YYYY-MM-DD, a calendar date with no time zone.
  startDate: string;
  status: RequestStatus;
  siteId: string;
  locationId: string;
  locationName: string;
  lineCount: number;
  createdByName: string;
};

export type RequestDetail = RequestRow & {
  siteName: string;
  rejectReason: string | null;
  lines: RequestLineInput[];
};

export type RequestPage = {
  rows: RequestRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type RequestListParams = PageParams & {
  status: RequestStatusFilter;
  type: RequestTypeFilter;
  // null means every site the actor can see.
  siteId: string | null;
  // null means every location the actor can see.
  locationId: string | null;
  sort: SortCriterion<RequestSortColumn>[];
};

// An active shift of a site, offered by the Shift select. Times are HH:mm.
export type RequestShiftChoice = {
  id: string;
  name: string;
  order: number;
  startTime: string;
  endTime: string;
  siteId: string;
};

export type RequestChoices = {
  sites: { id: string; name: string }[];
  locations: { id: string; name: string; siteId: string; timezone: LocationTimezone }[];
  departments: { id: string; name: string; locationId: string }[];
  subDepartments: { id: string; name: string; departmentId: string }[];
  positions: { id: string; name: string; siteId: string }[];
  shifts: RequestShiftChoice[];
};

export type RequestField = "type" | "startDate" | "locationId" | "lines";

export type RequestFieldErrors = Partial<Record<RequestField, string>>;

// The server never reports a site error, so only the form adds one.
export type RequestFormFieldErrors = RequestFieldErrors & { siteId?: string };

export type RequestActionResult =
  | { ok: true; id?: string; poNumber?: string }
  | {
      ok: false;
      fieldErrors?: RequestFieldErrors;
      formError?: string;
    };

export type RequestActions = {
  onOpen: (request: RequestRow) => void;
  onCancel: (request: RequestRow) => void;
  onApprove: (request: RequestRow) => void;
  onReject: (request: RequestRow) => void;
};

export type RequestLocationOption = { id: string; name: string };

export type RequestsDataTableProps = {
  data: RequestPage;
  status: RequestStatusFilter;
  type: RequestTypeFilter;
  // True for a superadmin with more than one site. HO and admin site get no site filter.
  pickSite: boolean;
  siteId: string | null;
  sites: SiteOption[];
  locationId: string | null;
  // The locations the location filter offers, already narrowed to the chosen site.
  locations: RequestLocationOption[];
  sort: SortCriterion<RequestSortColumn>[];
  // True for superadmin and HO. The server checks again in the action.
  canDecide: boolean;
};

export type RequestStatusFilterProps = { status: RequestStatusFilter };

export type RequestTypeFilterProps = { type: RequestTypeFilter };

export type RequestSiteFilterProps = {
  siteId: string | null;
  sites: SiteOption[];
};

export type RequestLocationFilterProps = {
  locationId: string | null;
  locations: RequestLocationOption[];
};

// Shared by the cancel, approve, and reject dialogs. A null request means the dialog is closed.
export type RequestDialogProps = {
  request: RequestRow | null;
  onOpenChange: (open: boolean) => void;
};

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type RequestActor = {
  id: string;
  name: string;
  role: string | null;
  siteId?: string | null;
  locationId?: string | null;
};

export type RequestFormProps = {
  request: RequestDetail | null;
  choices: RequestChoices;
  readOnly: boolean;
};

// One line in the form. headcount is the single number a daily line sends, and a weekly line
// repeats for every day while perDay is off. dayHeadcounts always holds seven numbers, used only
// when a weekly line has perDay on. NaN is an empty number. toRequestLineInputs turns this into a
// RequestLineInput on submit.
export type RequestFormLine = {
  departmentId: string;
  subDepartmentId: string | null;
  positionId: string;
  // null is Any shift.
  shiftId: string | null;
  headcount: number;
  perDay: boolean;
  dayHeadcounts: number[];
};

// The form's own state. An empty string is an unchosen type, date, site, location, department, or
// position, and NaN is an empty headcount. On submit toRequestLineInputs converts the lines and
// the zod schema turns the result into RequestInput.
// The site only narrows the locations; it is not part of RequestInput, because the server reads
// the site from the location.
export type RequestFormValues = {
  type: RequestType | "";
  startDate: string;
  siteId: string;
  locationId: string;
  lines: RequestFormLine[];
};

export type RequestOption = { id: string; name: string };

export type RequestLineFieldsProps = {
  index: number;
  line: RequestFormLine;
  // The per-day checkbox shows only for a weekly request.
  type: RequestType | "";
  // YYYY-MM-DD or empty. Labels the per-day fields.
  startDate: string;
  departments: RequestOption[];
  subDepartments: RequestOption[];
  positions: RequestOption[];
  disabled: boolean;
  canRemove: boolean;
  // Hidden when the form is read-only.
  showRemove: boolean;
  onChange: (line: RequestFormLine) => void;
  onRemove: () => void;
};

export type RequestStatusBadgeProps = { status: RequestStatus };
