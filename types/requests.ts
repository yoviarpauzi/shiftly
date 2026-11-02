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
  note: string | null;
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

export type RequestField = "type" | "startDate" | "locationId" | "note" | "lines";

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
