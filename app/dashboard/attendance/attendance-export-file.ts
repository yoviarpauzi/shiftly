import writeXlsxFile, { type SheetData } from "write-excel-file/node";
import type { ExportForm, ExportModel, ExportSheet } from "@/types/attendance-export";

type Row = SheetData[number];
type Cell = Row[number];

const EMPTY_SHEET_NAME = "Tidak ada jadwal";

// The worker table is columns A to E. The request table starts with its position label across A to
// C, so its counts begin in column D, under AREA.
const WORKER_COLUMNS = [6, 16, 30, 24, 16];
const LABEL_SPAN = 3;
const COUNT_COLUMN_WIDTH = 10;

const BORDER = { borderStyle: "thin", borderColor: "#000000" } as const;

const HEADER = { fontWeight: "bold", align: "center", ...BORDER } as const;

function header(value: string): Cell {
  return { value, ...HEADER };
}

// A bordered cell with nothing in it: SIGN, Actual, and ADD are filled in by hand on paper.
function empty(): Cell {
  return { ...BORDER };
}

function nulls(count: number): null[] {
  return Array.from({ length: Math.max(0, count) }, () => null);
}

// A cell that spans `span` columns, followed by the nulls the writer expects in the columns it covers.
function spanning(cell: Cell, span: number): Row {
  return [cell, ...nulls(span - 1)];
}

function formRows(title: string, department: string, form: ExportForm): SheetData {
  const shiftCount = form.shiftLabels.length;
  const rows: SheetData = [];

  rows.push(
    spanning({ value: title, fontWeight: "bold", fontSize: 14, columnSpan: WORKER_COLUMNS.length }, WORKER_COLUMNS.length),
  );
  rows.push([
    ...spanning({ value: `Tanggal: ${form.date}`, columnSpan: 2 }, 2),
    `Hari: ${form.weekday}`,
    `Area: ${department}`,
  ]);
  rows.push([]);

  rows.push(["NO", "ID", "NAMA", "AREA", "SIGN"].map(header));

  for (const worker of form.workers) {
    rows.push([
      { value: worker.no, align: "center", ...BORDER },
      // Text, so an ID such as 00123 keeps its zeros.
      { value: worker.employeeId, type: String, format: "@", ...BORDER },
      { value: worker.name, ...BORDER },
      { value: worker.position, ...BORDER },
      empty(),
    ]);
  }

  rows.push([]);

  rows.push([
    ...nulls(LABEL_SPAN),
    ...spanning({ value: "REQUEST", ...HEADER, columnSpan: shiftCount }, shiftCount),
    ...spanning({ value: "ACTUAL", ...HEADER, columnSpan: shiftCount }, shiftCount),
    header("ADD"),
  ]);
  rows.push([
    ...spanning({ ...HEADER, value: "Position", columnSpan: LABEL_SPAN }, LABEL_SPAN),
    ...form.shiftLabels.map(header),
    ...form.shiftLabels.map(header),
    empty(),
  ]);

  for (const request of form.requestRows) {
    rows.push([
      ...spanning({ value: request.position, columnSpan: LABEL_SPAN, ...BORDER }, LABEL_SPAN),
      ...request.counts.map((count): Cell =>
        count === null ? empty() : { value: count, align: "center", ...BORDER },
      ),
      ...form.shiftLabels.map(empty),
      empty(),
    ]);
  }

  rows.push([
    ...spanning({ value: "TOTAL", ...HEADER, columnSpan: LABEL_SPAN }, LABEL_SPAN),
    ...form.total.map((count): Cell =>
      count === null ? empty() : { value: count, fontWeight: "bold", align: "center", ...BORDER },
    ),
    ...form.shiftLabels.map(empty),
    empty(),
  ]);

  return rows;
}

function columnsFor(sheet: ExportSheet) {
  const shiftCount = sheet.forms[0]?.shiftLabels.length ?? 0;
  const widest = Math.max(WORKER_COLUMNS.length, LABEL_SPAN + 2 * shiftCount + 1);

  return [
    ...WORKER_COLUMNS,
    ...Array.from({ length: widest - WORKER_COLUMNS.length }, () => COUNT_COLUMN_WIDTH),
  ].map((width) => ({ width }));
}

function sheetRows(model: ExportModel, sheet: ExportSheet): SheetData {
  return sheet.forms.flatMap((form, index): SheetData => {
    const rows = formRows(model.title, sheet.department, form);

    // Two blank rows between forms, so each one prints as its own block.
    return index === 0 ? rows : [[], [], ...rows];
  });
}

// The printable forms as an .xlsx: one sheet per department, one form per day and shift. A week with
// nothing to export still gives a valid workbook, with one sheet that says so, because a writer
// given no sheets has nothing to write.
export function buildExportWorkbook(model: ExportModel): Promise<Buffer> {
  if (model.sheets.length === 0) {
    return writeXlsxFile([
      {
        sheet: EMPTY_SHEET_NAME,
        data: [[{ value: model.emptyMessage ?? "" }]],
        columns: [{ width: 70 }],
      },
    ]).toBuffer();
  }

  return writeXlsxFile(
    model.sheets.map((sheet) => ({
      sheet: sheet.name,
      data: sheetRows(model, sheet),
      columns: columnsFor(sheet),
    })),
  ).toBuffer();
}
