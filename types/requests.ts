import type { db } from "@/lib/db";
import type { PageParams } from "@/types/pagination";
import type { SortCriterion } from "@/types/sort";

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
  headcount: number;
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
  // null means every location the actor can see.
  locationId: string | null;
  sort: SortCriterion<RequestSortColumn>[];
};

export type RequestChoices = {
  locations: { id: string; name: string; siteId: string }[];
  departments: { id: string; name: string; locationId: string }[];
  subDepartments: { id: string; name: string; departmentId: string }[];
  positions: { id: string; name: string; siteId: string }[];
};

export type RequestField = "type" | "startDate" | "locationId" | "lines";

export type RequestFieldErrors = Partial<Record<RequestField, string>>;

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
  locationId: string | null;
  locations: RequestLocationOption[];
  sort: SortCriterion<RequestSortColumn>[];
  // True for superadmin and HO. The server checks again in the action.
  canDecide: boolean;
};

export type RequestStatusFilterProps = { status: RequestStatusFilter };

export type RequestTypeFilterProps = { type: RequestTypeFilter };

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

// The form's own state. An empty string is an unchosen type, date, location, department, or
// position, and NaN is an empty headcount. The zod schema turns these into RequestInput on submit.
export type RequestFormValues = {
  type: RequestType | "";
  startDate: string;
  locationId: string;
  lines: RequestLineInput[];
};

export type RequestOption = { id: string; name: string };

export type RequestLineFieldsProps = {
  index: number;
  line: RequestLineInput;
  departments: RequestOption[];
  subDepartments: RequestOption[];
  positions: RequestOption[];
  disabled: boolean;
  canRemove: boolean;
  // Hidden when the form is read-only.
  showRemove: boolean;
  onChange: (line: RequestLineInput) => void;
  onRemove: () => void;
};

export type RequestStatusBadgeProps = { status: RequestStatus };
