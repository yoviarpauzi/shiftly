import {
  IMPORT_COLUMNS,
  OPTIONAL_IMPORT_COLUMNS,
  type ImportCell,
  type ImportCellColumn,
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

  return isZip ? null : NOT_A_WORKBOOK_MESSAGE;
}

// A few KB of zip can inflate to gigabytes, and the reader unzips everything before it looks at a row.
// Generous for a sheet of 500 rows, small enough that the server never holds a bomb in memory.
export const IMPORT_MAX_EXPANDED_BYTES = 20_000_000;

const NOT_A_WORKBOOK_MESSAGE = "The file is not a valid .xlsx workbook";

const TOO_LARGE_UNZIPPED_MESSAGE = "The file is too large once unzipped";

const END_RECORD_SIGNATURE = 0x06054b50;

const ENTRY_SIGNATURE = 0x02014b50;

const END_RECORD_LENGTH = 22;

const ENTRY_HEADER_LENGTH = 46;

// Adds up the unzipped size every entry declares in the zip's central directory, without unzipping.
// A zip64 marker is refused because a real workbook of this size never needs it.
export function checkImportZip(bytes: Uint8Array): string | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const earliest = Math.max(0, bytes.length - END_RECORD_LENGTH - 0xffff);
  let end = -1;

  for (let at = bytes.length - END_RECORD_LENGTH; at >= earliest; at -= 1) {
    if (view.getUint32(at, true) === END_RECORD_SIGNATURE) {
      end = at;
      break;
    }
  }

  if (end < 0) {
    return NOT_A_WORKBOOK_MESSAGE;
  }

  const entries = view.getUint16(end + 10, true);
  let position = view.getUint32(end + 16, true);

  if (entries === 0xffff || position === 0xffffffff) {
    return TOO_LARGE_UNZIPPED_MESSAGE;
  }

  let total = 0;

  for (let entry = 0; entry < entries; entry += 1) {
    if (
      position + ENTRY_HEADER_LENGTH > bytes.length ||
      view.getUint32(position, true) !== ENTRY_SIGNATURE
    ) {
      return NOT_A_WORKBOOK_MESSAGE;
    }

    const size = view.getUint32(position + 24, true);

    total += size;

    if (size === 0xffffffff || total > IMPORT_MAX_EXPANDED_BYTES) {
      return TOO_LARGE_UNZIPPED_MESSAGE;
    }

    const nameLength = view.getUint16(position + 28, true);
    const extraLength = view.getUint16(position + 30, true);
    const commentLength = view.getUint16(position + 32, true);

    position += ENTRY_HEADER_LENGTH + nameLength + extraLength + commentLength;
  }

  return null;
}

export function checkImportHeaders(
  header: ImportCell[],
):
  | { ok: true; columnIndex: Record<ImportCellColumn, number> }
  | { ok: false; formError: string } {
  const names = header.map((cell) => (typeof cell === "string" ? cell.trim().toLowerCase() : ""));
  const missing = IMPORT_COLUMNS.filter((column) => !names.includes(column));

  if (missing.length > 0) {
    return { ok: false, formError: `Missing columns: ${missing.join(", ")}` };
  }

  // An optional column that is absent gets -1, and cells[-1] reads as undefined, like a blank cell.
  const columnIndex = Object.fromEntries(
    [...IMPORT_COLUMNS, ...OPTIONAL_IMPORT_COLUMNS].map((column) => [column, names.indexOf(column)]),
  ) as Record<ImportCellColumn, number>;

  return { ok: true, columnIndex };
}
