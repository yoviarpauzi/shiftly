import type { PageParams } from "@/types/pagination";
import type { RequestAccess } from "@/types/requests";

export type BillingMode = "monthly" | "weekly" | "custom";
export type BillingStatus = "draft" | "issued" | "void";
export type BillingStatusFilter = "all" | BillingStatus;
export type BillingAccess = RequestAccess;
export type BillingPeriod = { from: string; to: string };
export type BillingPeriodInput =
  | { mode: "monthly"; month: string } // YYYY-MM
  | { mode: "weekly"; date: string }
  | { mode: "custom"; from: string; to: string };

// One billable worker-day, before grouping.
export type BillableDay = {
  attendanceId: string;
  requestId: string;
  poNumber: string;
  departmentId: string;
  departmentName: string;
  subDepartmentId: string | null;
  subDepartmentName: string | null;
  positionId: string;
  positionName: string;
};
export type BillingLineView = Omit<BillableDay, "attendanceId"> & { days: number };
export type BillingPoGroup = { requestId: string; poNumber: string; lines: BillingLineView[]; subtotal: number };
export type BillingGroups = { pos: BillingPoGroup[]; totalDays: number };

export type BillingRow = {
  id: string; number: string | null; locationId: string; locationName: string; siteName: string;
  mode: BillingMode; periodStart: string; periodEnd: string; status: BillingStatus;
  totalDays: number | null; // null for a Draft
  issuedAt: string | null;
};
export type BillingListParams = Pick<PageParams, "page" | "pageSize"> & {
  status: BillingStatusFilter; siteId: string | null; locationId: string | null;
};
export type BillingPage = { rows: BillingRow[]; total: number; page: number; pageSize: number };

export type BillingDetail = {
  id: string; number: string | null; status: BillingStatus; mode: BillingMode;
  periodStart: string; periodEnd: string; siteId: string; locationId: string;
  locationName: string; siteName: string;
  version: string; // updatedAt as ISO text
  createdByName: string | null; issuedByName: string | null; issuedAt: string | null;
  voidedByName: string | null; voidedAt: string | null; voidReason: string | null;
  groups: BillingGroups;
  excludedDays: number | null; // Draft only: present days held by another billing
};
export type BillingActionResult = { ok: true; id: string } | { ok: false; formError: string };
export type BillingExportModel = {
  number: string; locationName: string; siteName: string; periodLabel: string; groups: BillingGroups;
};
