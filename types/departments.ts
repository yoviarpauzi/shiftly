import type { PageParams } from "@/types/pagination";
import type { SortCriterion } from "@/types/sort";

export type DepartmentSortColumn = "name" | "location" | "status";

export type DepartmentStatus = "active" | "deleted" | "all";

export type DepartmentAccess = {
  // null means every site or location, which only superadmin gets.
  siteId: string | null;
  locationId: string | null;
};

export type DepartmentRow = {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
  subDepartmentCount: number;
  deletedAt: Date | null;
};

export type DepartmentPage = {
  rows: DepartmentRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type DepartmentListParams = PageParams & {
  status: DepartmentStatus;
  // null means every location the actor can see.
  locationId: string | null;
  sort: SortCriterion<DepartmentSortColumn>[];
};

export type DepartmentLocationOption = {
  id: string;
  name: string;
  siteName: string;
};

// Superadmin and HO pick a location. A location manager gets its own location as fixed text.
export type DepartmentLocationChoice =
  | { mode: "pick"; locations: DepartmentLocationOption[] }
  | { mode: "fixed"; location: DepartmentLocationOption };

export type DepartmentActionResult =
  | { ok: true }
  | {
      ok: false;
      fieldErrors?: { name?: string; locationId?: string };
      formError?: string;
    };

export type DepartmentBulkDeleteResult = {
  deletedIds: string[];
  blocked: { id: string; formError: string }[];
};

export type DepartmentBulkRestoreResult = {
  restoredIds: string[];
  blocked: { id: string; formError: string }[];
};

export type BulkSelectionMode = "none" | "active" | "deleted" | "mixed";

export type DepartmentActions = {
  onEdit: (department: DepartmentRow) => void;
  onDelete: (department: DepartmentRow) => void;
  onRestore: (department: DepartmentRow) => void;
};

export type DepartmentFormDialogProps = {
  department: DepartmentRow | null;
  locationChoice: DepartmentLocationChoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type DeleteDepartmentDialogProps = {
  department: DepartmentRow | null;
  onOpenChange: (open: boolean) => void;
};

export type BulkDeleteDepartmentsDialogProps = {
  departments: DepartmentRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
};

export type SubDepartmentRow = {
  id: string;
  name: string;
  departmentId: string;
  deletedAt: Date | null;
};

export type SubDepartmentActionResult =
  | { ok: true }
  | {
      ok: false;
      fieldErrors?: { name?: string };
      formError?: string;
    };

export type SubDepartmentActions = {
  onEdit: (subDepartment: SubDepartmentRow) => void;
  onDelete: (subDepartment: SubDepartmentRow) => void;
  onRestore: (subDepartment: SubDepartmentRow) => void;
};

export type SubDepartmentTableProps = {
  departmentId: string;
  rows: SubDepartmentRow[];
};

export type SubDepartmentFormDialogProps = {
  departmentId: string;
  subDepartment: SubDepartmentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type DeleteSubDepartmentDialogProps = {
  subDepartment: SubDepartmentRow | null;
  onOpenChange: (open: boolean) => void;
};

export type EditDepartmentButtonProps = {
  department: DepartmentRow;
  locationChoice: DepartmentLocationChoice;
};
