import type { PageParams } from "@/types/pagination";
import type { SortCriterion } from "@/types/sort";
import type { LocationTimezone } from "@/validation/location";

export type LocationSortColumn = "name" | "status";

// Only HO manages locations, and an HO sees every location.
export type LocationAccess = { role: "ho" };

export type LocationRow = {
  id: string;
  name: string;
  timezone: LocationTimezone;
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

export type LocationFieldErrors = {
  name?: string;
  timezone?: string;
};

export type LocationActionResult =
  | { ok: true }
  | {
      ok: false;
      fieldErrors?: LocationFieldErrors;
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
