import type { WorkDays } from "@/types/settings";

export const IMPORT_COLUMNS = [
  "employee_id",
  "name",
  "site",
  "location",
  "positions",
  "end_contract",
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

// Read when present, never required, so a file from the old template still imports.
export const OPTIONAL_IMPORT_COLUMNS = ["work_days"] as const;

export type ImportCellColumn = ImportColumn | (typeof OPTIONAL_IMPORT_COLUMNS)[number];

export type ImportCell = string | number | boolean | Date | null;

// rowNumber is the Excel row number, so the header is row 1 and the first worker is row 2.
export type ImportRawRow = {
  rowNumber: number;
  cells: Record<ImportCellColumn, ImportCell>;
};

export type ImportRowBase = {
  rowNumber: number;
  employeeId: string;
  name: string;
  siteName: string;
  locationName: string;
  positionNames: string[];
  // YYYY-MM-DD when valid, otherwise the cell as read, so the preview shows what is wrong.
  endContract: string;
  // null means "do not touch": a created worker gets no override and an updated one keeps its own.
  workDays: WorkDays | null;
};

export type ImportRowResult =
  | (ImportRowBase & { action: "error"; errors: string[] })
  | (ImportRowBase & {
      action: "create" | "update";
      errors: [];
      // null for a create.
      workerId: string | null;
      siteId: string;
      locationId: string;
      positionIds: string[];
    });

export type ImportSummary = { create: number; update: number; error: number };

export type ImportPreview = { rows: ImportRowResult[]; summary: ImportSummary };

export type ImportPreviewResult = ({ ok: true } & ImportPreview) | { ok: false; formError: string };

export type ImportCommitResult =
  | { ok: true; created: number; updated: number }
  | { ok: false; formError?: string; preview?: ImportPreview };

// Sites, locations, and positions are already limited to what the actor may write to.
// existing holds active workers of any scope whose employee ID is in the file, so the resolver
// can tell an update from an ID that belongs to a worker out of scope.
export type ImportLookups = {
  sites: { id: string; name: string }[];
  locations: { id: string; siteId: string; name: string }[];
  positions: { id: string; siteId: string; name: string }[];
  existing: { id: string; employeeId: string; siteId: string; locationId: string }[];
};

export type ImportWorkersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
