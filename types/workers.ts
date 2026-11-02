import type { SiteChoice } from "@/types/locations";
import type { PageParams } from "@/types/pagination";
import type { SortCriterion } from "@/types/sort";

export type WorkerSortColumn = "employeeId" | "name" | "site" | "location" | "status";

export type WorkerStatus = "active" | "deleted" | "all";

export type WorkerAccess = {
  // null means every site, which only superadmin gets.
  siteId: string | null;
  // null means every location in the site. Only admin site is limited to one location.
  locationId: string | null;
};

export type WorkerPositionTag = { id: string; name: string };

export type WorkerRow = {
  id: string;
  employeeId: string;
  name: string;
  siteId: string;
  siteName: string;
  locationId: string;
  locationName: string;
  positions: WorkerPositionTag[];
  deletedAt: Date | null;
};

export type WorkerPage = {
  rows: WorkerRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type WorkerListParams = PageParams & {
  status: WorkerStatus;
  // null means every site the actor can see.
  siteId: string | null;
  // null means every location the actor can see.
  locationId: string | null;
  sort: SortCriterion<WorkerSortColumn>[];
};

export type WorkerFormOption = { id: string; siteId: string; name: string };

// What the form can pick from. Every list is already limited to what the actor may write to.
export type WorkerFormOptions = {
  siteChoice: SiteChoice;
  locations: WorkerFormOption[];
  positions: WorkerFormOption[];
};

export type WorkerFieldErrors = {
  employeeId?: string;
  name?: string;
  siteId?: string;
  locationId?: string;
  positionIds?: string;
};

export type WorkerActionResult =
  | { ok: true }
  | { ok: false; fieldErrors?: WorkerFieldErrors; formError?: string };

export type WorkerBulkDeleteResult = {
  deletedIds: string[];
  blocked: { id: string; formError: string }[];
};

export type WorkerBulkRestoreResult = {
  restoredIds: string[];
  blocked: { id: string; formError: string }[];
};

export type WorkerActions = {
  onEdit: (worker: WorkerRow) => void;
  onDelete: (worker: WorkerRow) => void;
  onRestore: (worker: WorkerRow) => void;
};

export type WorkerFormDialogProps = {
  worker: WorkerRow | null;
  options: WorkerFormOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type BulkDeleteWorkersDialogProps = {
  workers: WorkerRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};

export type DeleteWorkerDialogProps = {
  worker: WorkerRow | null;
  onOpenChange: (open: boolean) => void;
};

export type WorkerFilterOption = { value: string; label: string };

export type WorkersSelectFilterProps = {
  param: string;
  value: string;
  options: WorkerFilterOption[];
  ariaLabel: string;
  className: string;
  // Other params to drop when this filter changes, such as a location that belongs to the old site.
  resets?: string[];
};
