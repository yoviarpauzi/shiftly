import {
  IMPORT_COLUMNS,
  type ImportCell,
  type ImportColumn,
} from "@/types/worker-import";

// Kept under the 1 MB body limit Server Actions have by default, which leaves room for the multipart overhead.
export const IMPORT_MAX_BYTES = 1_000_000;

export const IMPORT_MAX_ROWS = 500;

// A .xlsx file is a zip archive, and every zip starts with these two bytes.
const ZIP_SIGNATURE = [0x50, 0x4b];

export function checkImportFileMeta({ name, size }: { name: string; size: number }): string | null {
  if (!name.toLowerCase().endsWith(".xlsx")) {
    return "Choose an .xlsx file";
  }

  if (size === 0) {
    return "The file is empty";
  }

  if (size > IMPORT_MAX_BYTES) {
    return "The file is larger than 1 MB";
  }

  return null;
}

export function checkImportFileBytes(bytes: Uint8Array): string | null {
  const isZip = ZIP_SIGNATURE.every((byte, index) => bytes[index] === byte);

  return isZip ? null : "The file is not a valid .xlsx workbook";
}

export function checkImportHeaders(
  header: ImportCell[],
):
  | { ok: true; columnIndex: Record<ImportColumn, number> }
  | { ok: false; formError: string } {
  const names = header.map((cell) => (typeof cell === "string" ? cell.trim().toLowerCase() : ""));
  const missing = IMPORT_COLUMNS.filter((column) => !names.includes(column));

  if (missing.length > 0) {
    return { ok: false, formError: `Missing columns: ${missing.join(", ")}` };
  }

  const columnIndex = Object.fromEntries(
    IMPORT_COLUMNS.map((column) => [column, names.indexOf(column)]),
  ) as Record<ImportColumn, number>;

  return { ok: true, columnIndex };
}
