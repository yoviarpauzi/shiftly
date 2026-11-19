import ExcelJS from "exceljs";
import type { BillingExportModel } from "@/types/billings";

const SHEET_NAME = "Billing";
const HEADINGS = ["PO", "Department", "Sub-department", "Position", "Days"];
const COLUMN_WIDTHS = [24, 24, 24, 24, 10];
const DAYS_COLUMN = 5;
const SUBTOTAL_FILL = "FFEFEFEF";
const TOTAL_FILL = "FFE8E8E8";

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

function styleRow(row: ExcelJS.Row, options: { bold?: boolean; fill?: string }) {
  for (let column = 1; column <= HEADINGS.length; column += 1) {
    const cell = row.getCell(column);

    cell.border = THIN_BORDER;
    cell.font = { bold: options.bold ?? false };
    cell.alignment = { horizontal: column === DAYS_COLUMN ? "right" : "left", vertical: "middle" };

    if (options.fill) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: options.fill } };
    }
  }
}

// "BL-JKT-202611-0001" as "billing-bl-jkt-202611-0001.xlsx".
export function billingExportFileName(number: string): string {
  const slug = number
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `billing-${slug}.xlsx`;
}

// An issued billing as an .xlsx: the number, location and period on top, then the lines grouped by
// PO with a subtotal after each PO and the total days last. Days only, no rates or amounts.
export async function buildBillingWorkbook(model: BillingExportModel): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(SHEET_NAME);

  COLUMN_WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  sheet.getCell("A1").value = `Billing ${model.number}`;
  sheet.getCell("A1").font = { bold: true, size: 16 };

  const info: [string, string][] = [
    ["Site", model.siteName],
    ["Location", model.locationName],
    ["Period", model.periodLabel],
  ];

  info.forEach(([label, value], index) => {
    const row = sheet.getRow(index + 2);

    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value;
  });

  const header = sheet.getRow(info.length + 3);

  HEADINGS.forEach((heading, index) => {
    header.getCell(index + 1).value = heading;
  });
  styleRow(header, { bold: true, fill: SUBTOTAL_FILL });

  let next = header.number + 1;

  for (const group of model.groups.pos) {
    for (const line of group.lines) {
      const row = sheet.getRow(next);

      row.getCell(1).value = group.poNumber;
      row.getCell(2).value = line.departmentName;
      row.getCell(3).value = line.subDepartmentName;
      row.getCell(4).value = line.positionName;
      row.getCell(DAYS_COLUMN).value = line.days;
      styleRow(row, {});
      next += 1;
    }

    const subtotal = sheet.getRow(next);

    subtotal.getCell(1).value = "Subtotal";
    subtotal.getCell(DAYS_COLUMN).value = group.subtotal;
    styleRow(subtotal, { bold: true, fill: SUBTOTAL_FILL });
    next += 1;
  }

  const total = sheet.getRow(next);

  total.getCell(1).value = "Total days";
  total.getCell(DAYS_COLUMN).value = model.groups.totalDays;
  styleRow(total, { bold: true, fill: TOTAL_FILL });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
