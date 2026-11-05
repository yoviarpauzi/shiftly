import type { PageParams } from "@/types/pagination";
import type { SortCriterion } from "@/types/sort";

export type ShiftSortColumn = "order" | "name" | "location" | "status";

export type ShiftStatus = "active" | "deleted" | "all";

export type ShiftAccess = {
  // Both null means every location, which only superadmin gets. A site id limits access to the
  // locations of that site (HO). A location id limits it to that one location (admin site).
  siteId: string | null;
  locationId: string | null;
};

export type ShiftLocationOption = {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
};

// The form either lets the actor pick a location or has one fixed for them.
export type ShiftLocationChoice =
  | { mode: "pick"; locations: ShiftLocationOption[] }
  | { mode: "fixed"; location: ShiftLocationOption };

export type ShiftRow = {
  id: string;
  order: number;
  name: string;
  // 24 hour HH:MM. A shift whose end is earlier than its start crosses midnight.
  startTime: string;
  endTime: string;
  locationId: string;
  locationName: string;
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
  // null means every location the actor can see.
  locationId: string | null;
  sort: SortCriterion<ShiftSortColumn>[];
};

export type ShiftField = "order" | "name" | "startTime" | "endTime" | "locationId";

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
  locationChoice: ShiftLocationChoice;
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
