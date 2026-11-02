import type { SiteChoice } from "@/types/locations";
import type { PageParams } from "@/types/pagination";
import type { SortCriterion } from "@/types/sort";

export type ShiftSortColumn = "order" | "name" | "site" | "status";

export type ShiftStatus = "active" | "deleted" | "all";

export type ShiftAccess = {
  // null means every site, which only superadmin gets.
  siteId: string | null;
};

export type ShiftRow = {
  id: string;
  order: number;
  name: string;
  // 24 hour HH:MM. A shift whose end is earlier than its start crosses midnight.
  startTime: string;
  endTime: string;
  siteId: string;
  siteName: string;
  deletedAt: Date | null;
};

export type ShiftPage = {
  rows: ShiftRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type ShiftListParams = PageParams & {
  status: ShiftStatus;
  // null means every site the actor can see.
  siteId: string | null;
  sort: SortCriterion<ShiftSortColumn>[];
};

export type ShiftField = "order" | "name" | "startTime" | "endTime" | "siteId";

export type ShiftFieldErrors = Partial<Record<ShiftField, string>>;

export type ShiftActionResult =
  | { ok: true }
  | {
      ok: false;
      fieldErrors?: ShiftFieldErrors;
      formError?: string;
    };

export type ShiftBulkDeleteResult = {
  deletedIds: string[];
  blocked: { id: string; formError: string }[];
};

export type ShiftBulkRestoreResult = {
  restoredIds: string[];
  blocked: { id: string; formError: string }[];
};

export type ShiftActions = {
  onEdit: (shift: ShiftRow) => void;
  onDelete: (shift: ShiftRow) => void;
  onRestore: (shift: ShiftRow) => void;
};

export type ShiftFormDialogProps = {
  shift: ShiftRow | null;
  siteChoice: SiteChoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type DeleteShiftDialogProps = {
  shift: ShiftRow | null;
  onOpenChange: (open: boolean) => void;
};

export type BulkDeleteShiftsDialogProps = {
  shifts: ShiftRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};
