import type { SiteChoice } from "@/types/locations";
import type { PageParams } from "@/types/pagination";
import type { SortCriterion } from "@/types/sort";

export type PositionSortColumn = "name" | "site" | "status";

export type PositionStatus = "active" | "deleted" | "all";

export type PositionAccess = {
  // null means every site, which only superadmin gets.
  siteId: string | null;
};

export type PositionRow = {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
  deletedAt: Date | null;
};

export type PositionPage = {
  rows: PositionRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type PositionListParams = PageParams & {
  status: PositionStatus;
  // null means every site the actor can see.
  siteId: string | null;
  sort: SortCriterion<PositionSortColumn>[];
};

export type PositionActionResult =
  | { ok: true }
  | {
      ok: false;
      fieldErrors?: { name?: string; siteId?: string };
      formError?: string;
    };

export type PositionBulkDeleteResult = {
  deletedIds: string[];
  blocked: { id: string; formError: string }[];
};

export type PositionBulkRestoreResult = {
  restoredIds: string[];
  blocked: { id: string; formError: string }[];
};

export type PositionActions = {
  onEdit: (position: PositionRow) => void;
  onDelete: (position: PositionRow) => void;
  onRestore: (position: PositionRow) => void;
};

export type PositionFormDialogProps = {
  position: PositionRow | null;
  siteChoice: SiteChoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type DeletePositionDialogProps = {
  position: PositionRow | null;
  onOpenChange: (open: boolean) => void;
};

export type BulkDeletePositionsDialogProps = {
  positions: PositionRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};
