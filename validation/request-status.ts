import type {
  RequestStatus,
  RequestStatusFilter,
  RequestType,
  RequestTypeFilter,
} from "@/types/requests";

export const REQUEST_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const satisfies readonly RequestStatus[];

export const REQUEST_TYPES = ["daily", "weekly"] as const satisfies readonly RequestType[];

// Reads the status filter from the URL. Anything missing or unknown shows every status.
export function parseRequestStatus(value: string | string[] | undefined): RequestStatusFilter {
  const first = Array.isArray(value) ? value[0] : value;

  return (REQUEST_STATUSES as readonly string[]).includes(first ?? "")
    ? (first as RequestStatus)
    : "all";
}

// Reads the type filter from the URL. Anything missing or unknown shows every type.
export function parseRequestType(value: string | string[] | undefined): RequestTypeFilter {
  const first = Array.isArray(value) ? value[0] : value;

  return (REQUEST_TYPES as readonly string[]).includes(first ?? "")
    ? (first as RequestType)
    : "all";
}
