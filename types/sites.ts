import type { PageParams } from "@/types/pagination";
import type { SortCriterion } from "@/types/sort";

export type SiteSortColumn = "name" | "locations" | "status";

export type SiteRow = {
  id: string;
  name: string;
  code: string | null;
  locationCount: number;
  deletedAt: Date | null;
};

export type SitePage = {
  rows: SiteRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type SiteStatus = "active" | "deleted" | "all";

export type SiteListParams = PageParams & {
  status: SiteStatus;
  sort: SortCriterion<SiteSortColumn>[];
};

export type SiteActionResult =
  | { ok: true }
  | { ok: false; fieldErrors?: { name?: string; code?: string }; formError?: string };

export type SiteBulkDeleteResult = {
  deletedIds: string[];
  blocked: { id: string; formError: string }[];
};

export type SiteBulkRestoreResult = {
  restoredIds: string[];
  blocked: { id: string; formError: string }[];
};

export type BulkSelectionMode = "none" | "active" | "deleted" | "mixed";

export type SiteActions = {
  onEdit: (site: SiteRow) => void;
  onDelete: (site: SiteRow) => void;
  onRestore: (site: SiteRow) => void;
};

export type SiteFormDialogProps = {
  site: SiteRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type DeleteSiteDialogProps = {
  site: SiteRow | null;
  onOpenChange: (open: boolean) => void;
};

export type BulkDeleteSitesDialogProps = {
  sites: SiteRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};
