import { readSheet } from "read-excel-file/node";
import writeXlsxFile, { type SheetData } from "write-excel-file/node";
import { IMPORT_COLUMNS, type ImportCell, type ImportColumn, type ImportRawRow } from "@/types/worker-import";
import { checkImportHeaders, IMPORT_MAX_ROWS } from "@/validation/worker-import";

const NOT_A_WORKBOOK_MESSAGE = "The file is not a valid .xlsx workbook";

const NO_WORKERS_MESSAGE = "The file has no workers";

function isBlank(cells: ImportCell[]) {
  return cells.every((cell) => cell === null || (typeof cell === "string" && cell.trim() === ""));
}

// Reads the first sheet. Excel keeps formatted but empty rows below a table, so blank rows are skipped
// and never count toward the limit. rowNumber is the Excel row, so a person can find it in the file.
export async function readImportSheet(
  bytes: Buffer,
): Promise<{ ok: true; rows: ImportRawRow[] } | { ok: false; formError: string }> {
  let sheet: ImportCell[][];

  try {
    sheet = (await readSheet(bytes)) as ImportCell[][];
  } catch {
    return { ok: false, formError: NOT_A_WORKBOOK_MESSAGE };
  }

  const [header, ...body] = sheet;

  if (!header) {
    return { ok: false, formError: NO_WORKERS_MESSAGE };
  }

  const headers = checkImportHeaders(header);

  if (!headers.ok) {
    return headers;
  }

  const rows = body.flatMap((cells, index): ImportRawRow[] => {
    if (isBlank(cells)) {
      return [];
    }

    const picked = Object.fromEntries(
      IMPORT_COLUMNS.map((column) => [column, cells[headers.columnIndex[column]] ?? null]),
    ) as Record<ImportColumn, ImportCell>;

    return [{ rowNumber: index + 2, cells: picked }];
  });

  if (rows.length === 0) {
    return { ok: false, formError: NO_WORKERS_MESSAGE };
  }

  if (rows.length > IMPORT_MAX_ROWS) {
    return { ok: false, formError: `The file has more than ${IMPORT_MAX_ROWS} rows` };
  }

  return { ok: true, rows };
}

// The header, one example worker, and empty text cells in the employee ID column for every row the
// import accepts, so Excel keeps IDs such as 00123 as typed.
export function buildImportTemplate(): Promise<Buffer> {
  const textCell = { type: String, format: "@" };
  const data: SheetData = [
    IMPORT_COLUMNS.map((column) => ({ value: column, fontWeight: "bold" as const })),
    [{ ...textCell, value: "EMP-001" }, "Budi Santoso", "Alpha", "Gudang", "Operator, Driver"],
  ];

  for (let index = 1; index < IMPORT_MAX_ROWS; index += 1) {
    data.push([textCell]);
  }

  return writeXlsxFile(data, { columns: IMPORT_COLUMNS.map(() => ({ width: 24 })) }).toBuffer();
}
