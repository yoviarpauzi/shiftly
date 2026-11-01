import type { PageParams } from "@/types/pagination";
import type { SortCriterion } from "@/types/sort";

export type LocationSortColumn = "name" | "site" | "status";

export type LocationAccess = {
  // null means every site, which only superadmin gets.
  siteId: string | null;
};

export type LocationRow = {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
  deletedAt: Date | null;
};

export type LocationPage = {
  rows: LocationRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type LocationStatus = "active" | "deleted" | "all";

export type LocationListParams = PageParams & {
  status: LocationStatus;
  sort: SortCriterion<LocationSortColumn>[];
};

export type SiteOption = { id: string; name: string };

// Superadmin picks a site. HO gets its own site as fixed text.
export type SiteChoice =
  | { mode: "pick"; sites: SiteOption[] }
  | { mode: "fixed"; site: SiteOption };

export type LocationActionResult =
  | { ok: true }
  | {
      ok: false;
      fieldErrors?: { name?: string; siteId?: string };
      formError?: string;
    };

export type LocationBulkDeleteResult = {
  deletedIds: string[];
  blocked: { id: string; formError: string }[];
};

export type LocationBulkRestoreResult = {
  restoredIds: string[];
  blocked: { id: string; formError: string }[];
};

export type BulkSelectionMode = "none" | "active" | "deleted" | "mixed";

export type LocationActions = {
  onEdit: (location: LocationRow) => void;
  onDelete: (location: LocationRow) => void;
  onRestore: (location: LocationRow) => void;
};

export type LocationFormDialogProps = {
  location: LocationRow | null;
  siteChoice: SiteChoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type DeleteLocationDialogProps = {
  location: LocationRow | null;
  onOpenChange: (open: boolean) => void;
};

export type BulkDeleteLocationsDialogProps = {
  locations: LocationRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};
