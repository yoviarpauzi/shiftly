import type { PageParams } from "@/types/pagination";
import type { SortCriterion } from "@/types/sort";

export type PositionSortColumn = "name" | "status";

export type PositionStatus = "active" | "deleted" | "all";

// Positions are global. Both roles that manage them see every position.
export type PositionAccess = { role: "ho" | "admin_site" };

export type PositionRow = {
  id: string;
  name: string;
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
  sort: SortCriterion<PositionSortColumn>[];
};

export type PositionActionResult =
  | { ok: true }
  | {
      ok: false;
      fieldErrors?: { name?: string };
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
