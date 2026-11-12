import ExcelJS from "exceljs";
import type { ExportBand, ExportDay, ExportModel, ExportSheet } from "@/types/attendance-export";

// The layout of the printed template (Schedule Weekly & Daily): up to three forms side by side, each
// eleven columns wide with a spacer column after it, and a band of rows for each day. The first band
// has its title in row 3, and every cell below sits at a fixed distance from the title row.

const EMPTY_SHEET_NAME = "Tidak ada jadwal";
const FONT = "Aptos Narrow";

const FIRST_ROW = 3;
const FIRST_COLUMN = 2;
const FORM_STRIDE = 12;
const MIN_SLOT_ROWS = 20;

// Column A, then the eleven columns of a form: NO, ID, NAMA, AREA, SIGN, a narrow gap, then the same
// five again for the second list of slots.
const MARGIN_COLUMN_WIDTH = 2.14;
const FORM_WIDTHS = [3.71, 16, 25.71, 13.28, 12.57, 1.14, 4.14, 16, 25.71, 12.57, 12.57];

const DATE_FORMAT = "[$-F800]dddd\\,\\ mmmm\\ dd\\,\\ yyyy";

const PEACH = "FFF7C7AC";
const GRAY = "FFEFEFEF";
const TOTAL_GRAY = "FFE8E8E8";

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

type Look = {
  bold?: boolean;
  size?: number;
  color?: string;
  align?: "left" | "center" | "right";
  wrap?: boolean;
  border?: boolean;
  fill?: string;
  numFmt?: string;
};

function paint(cell: ExcelJS.Cell, look: Look) {
  cell.font = { name: FONT, size: look.size ?? 12, bold: look.bold ?? false, color: look.color ? { argb: look.color } : undefined };
  cell.alignment = { horizontal: look.align, vertical: "middle", wrapText: look.wrap ?? false };

  if (look.border) {
    cell.border = THIN_BORDER;
  }

  if (look.fill) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: look.fill } };
  }

  if (look.numFmt) {
    cell.numFmt = look.numFmt;
  }
}

// Writes a value, and merges the cell over `span` columns (and `rows` rows) when asked. Every cell of
// a merged range gets the look, so its border and fill show all the way round.
function put(
  sheet: ExcelJS.Worksheet,
  row: number,
  column: number,
  value: ExcelJS.CellValue,
  look: Look,
  span = 1,
  rows = 1,
) {
  if (span > 1 || rows > 1) {
    sheet.mergeCells(row, column, row + rows - 1, column + span - 1);
  }

  for (let r = row; r < row + rows; r += 1) {
    for (let c = column; c < column + span; c += 1) {
      paint(sheet.getCell(r, c), look);
    }
  }

  sheet.getCell(row, column).value = value;
}

function utcDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function slotRows(band: ExportBand): number {
  const most = Math.max(0, ...band.forms.map((form) => form.workers.length));

  return Math.max(MIN_SLOT_ROWS, Math.ceil(most / 2));
}

// One band: the forms of a day side by side. Returns the row the next band's title goes in.
function writeBand(
  sheet: ExcelJS.Worksheet,
  top: number,
  title: string,
  department: string,
  day: ExportDay,
  band: ExportBand,
): number {
  const slots = slotRows(band);
  const requestTop = top + 8 + slots + 2;
  const total = requestTop + 2 + band.requestRows.length;
  const prepared = total + 2;
  const signature = prepared + 4;
  const shifts = band.shiftLabels.length;
  const heights: [number, number][] = [
    [top, 31.8],
    [top + 2, 21.2],
    [top + 3, 21.2],
    [top + 4, 21.2],
    [top + 5, 21.2],
    [top + 7, 22.7],
    [top + 8, 21.2],
    [requestTop, 26.5],
    [requestTop + 1, 22.5],
    [total, 22.7],
    [prepared, 22.7],
    [prepared + 1, 22.7],
    [prepared + 2, 22.7],
    [prepared + 3, 22.7],
    [signature, 22.7],
  ];

  for (let row = top + 9; row < top + 9 + slots; row += 1) {
    heights.push([row, 24.6]);
  }

  for (let row = requestTop + 2; row < total; row += 1) {
    heights.push([row, 22.5]);
  }

  for (const [row, height] of heights) {
    sheet.getRow(row).height = height;
  }

  band.forms.forEach((form, index) => {
    const c0 = FIRST_COLUMN + index * FORM_STRIDE;

    put(sheet, top, c0, title, { bold: true, size: 20, align: "center" }, 11);

    const info: [string, ExcelJS.CellValue, Look?][] = [
      ["Tanggal", utcDate(day.date), { numFmt: DATE_FORMAT, align: "left" }],
      ["Hari", day.weekday],
      ["Shift", form.shiftOrder],
      ["Area", department],
    ];

    info.forEach(([label, value, look], offset) => {
      const row = top + 2 + offset;

      put(sheet, row, c0, label, { bold: true, align: "left" });
      put(sheet, row, c0 + 2, ":", { bold: true, align: "left" });
      put(sheet, row, c0 + 3, value, { align: "left", ...look }, 5);
    });

    put(sheet, top + 7, c0, null, {}, 11);

    for (const start of [c0, c0 + 6]) {
      ["NO", "ID", "NAMA", "AREA", "SIGN"].forEach((heading, offset) =>
        put(sheet, top + 8, start + offset, heading, { bold: true, align: "center", border: true }),
      );
    }

    for (let slot = 0; slot < slots; slot += 1) {
      const row = top + 9 + slot;

      [0, 1].forEach((side) => {
        const start = c0 + side * 6;
        const worker = form.workers[side * slots + slot];

        put(sheet, row, start, side * slots + slot + 1, { align: "center", border: true });
        // Text, so an ID such as 00123 keeps its zeros.
        put(sheet, row, start + 1, worker?.employeeId ?? null, { align: "center", border: true, numFmt: "@" });
        put(sheet, row, start + 2, worker?.name ?? null, { size: 11, align: "left", border: true });
        put(sheet, row, start + 3, worker?.position ?? null, { size: 11, align: "left", border: true });
        put(sheet, row, start + 4, null, { size: 11, border: true });
      });
    }

    // The request table: REQUEST over the first columns, ACTUAL over the same count under the second
    // list, and ADD to the right. Actual and ADD are filled in by hand.
    put(sheet, requestTop, c0 + 1, department, { bold: true, size: 14, color: "FFFF0000", wrap: true, align: "left" });
    put(sheet, requestTop, c0 + 2, "REQUEST", { bold: true, size: 11, align: "center", border: true, fill: PEACH }, shifts);
    put(sheet, requestTop, c0 + 7, "ACTUAL", { bold: true, size: 11, align: "center", border: true, fill: PEACH }, shifts);
    put(sheet, requestTop, c0 + 10, "ADD", { bold: true, size: 11, align: "center", border: true, fill: PEACH }, 1, 2);

    put(sheet, requestTop + 1, c0 + 1, "Position", { bold: true, wrap: true, border: true, fill: GRAY, align: "left" });

    band.shiftLabels.forEach((label, offset) => {
      const text = `${day.weekday} ${label}`;

      put(sheet, requestTop + 1, c0 + 2 + offset, text, { bold: true, align: "center", border: true, fill: GRAY });
      put(sheet, requestTop + 1, c0 + 7 + offset, text, { bold: true, align: "center", border: true, fill: GRAY });
    });

    band.requestRows.forEach((request, rowIndex) => {
      const row = requestTop + 2 + rowIndex;

      put(sheet, row, c0 + 1, request.position, { size: 11, wrap: true, border: true, align: "left" });
      request.counts.forEach((count, offset) => {
        put(sheet, row, c0 + 2 + offset, count, { align: "center", border: true });
        put(sheet, row, c0 + 7 + offset, null, { align: "center", border: true });
      });
      put(sheet, row, c0 + 10, null, { border: true });
    });

    put(sheet, total, c0 + 1, "TOTAL", { bold: true, size: 14, border: true, fill: TOTAL_GRAY, align: "left" });
    band.total.forEach((count, offset) => {
      put(sheet, total, c0 + 2 + offset, count, { bold: true, align: "center", border: true, fill: TOTAL_GRAY });
      put(sheet, total, c0 + 7 + offset, null, { border: true, fill: TOTAL_GRAY });
    });
    put(sheet, total, c0 + 10, null, { border: true, fill: TOTAL_GRAY });

    put(sheet, prepared, c0 + 1, "Prepared By,", { bold: true, size: 14, align: "center" }, 3);
    put(sheet, prepared, c0 + 7, "FLM / SO", { bold: true, size: 14, align: "center" }, 4);
    put(sheet, signature, c0 + 1, `(${" ".repeat(49)})`, { size: 11, align: "center" }, 3);
    put(sheet, signature, c0 + 7, `(${" ".repeat(49)})`, { size: 11, align: "center" }, 4);
  });

  return signature + 2;
}

function writeSheet(workbook: ExcelJS.Workbook, model: ExportModel, entry: ExportSheet) {
  const sheet = workbook.addWorksheet(entry.name, {
    views: [{ showGridLines: false, zoomScale: 70, zoomScaleNormal: 70 }],
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      scale: 65,
      fitToPage: false,
      margins: {
        left: 0.236220472440945,
        right: 0.236220472440945,
        top: 0.748031496062992,
        bottom: 0.748031496062992,
        header: 0.31496062992126,
        footer: 0.31496062992126,
      },
    },
  });
  const formCount = Math.max(1, ...entry.days.flatMap((day) => day.bands.map((band) => band.forms.length)));

  sheet.getColumn(1).width = MARGIN_COLUMN_WIDTH;

  for (let form = 0; form < formCount; form += 1) {
    FORM_WIDTHS.forEach((width, offset) => {
      sheet.getColumn(FIRST_COLUMN + form * FORM_STRIDE + offset).width = width;
    });
  }

  let top = FIRST_ROW;

  for (const day of entry.days) {
    for (const band of day.bands) {
      const next = writeBand(sheet, top, model.title, entry.department, day, band);

      // Each band starts a new printed page.
      sheet.getRow(next - 1).addPageBreak();
      top = next;
    }
  }

  // The last band needs no break after it. exceljs keeps the breaks in a list its types leave out.
  (sheet as unknown as { rowBreaks: unknown[] }).rowBreaks.pop();
}

// The printable forms as an .xlsx, laid out like the template: one sheet per department, a band of
// rows per day with the shift forms side by side. A week with nothing to export still gives a valid
// workbook with one sheet that says so.
export async function buildExportWorkbook(model: ExportModel): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  if (model.sheets.length === 0) {
    const sheet = workbook.addWorksheet(EMPTY_SHEET_NAME);

    sheet.getColumn(1).width = 70;
    sheet.getCell("A1").value = model.emptyMessage ?? "";
  }

  for (const entry of model.sheets) {
    writeSheet(workbook, model, entry);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
