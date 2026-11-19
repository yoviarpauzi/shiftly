import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { BillingExportModel } from "@/types/billings";
import { billingExportFileName, buildBillingWorkbook } from "./billing-export-file";

const line = (poNumber: string, position: string, days: number, subDepartmentName: string | null = null) => ({
  requestId: poNumber,
  poNumber,
  departmentId: "d1",
  departmentName: "Produksi",
  subDepartmentId: subDepartmentName ? "sd1" : null,
  subDepartmentName,
  positionId: `p-${position}`,
  positionName: position,
  days,
});

const model: BillingExportModel = {
  number: "BL-JKT-202611-0001",
  locationName: "Kejayan",
  siteName: "Jakarta",
  periodLabel: "1 Nov 2026 to 30 Nov 2026",
  groups: {
    pos: [
      {
        requestId: "PO-A",
        poNumber: "PO-A",
        lines: [line("PO-A", "Operator", 3, "Press"), line("PO-A", "Helper", 2)],
        subtotal: 5,
      },
      { requestId: "PO-B", poNumber: "PO-B", lines: [line("PO-B", "Operator", 2)], subtotal: 2 },
    ],
    totalDays: 7,
  },
};

async function load(input: BillingExportModel) {
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load((await buildBillingWorkbook(input)) as unknown as ArrayBuffer);

  return workbook;
}

const rowValues = (sheet: ExcelJS.Worksheet, row: number) =>
  [1, 2, 3, 4, 5].map((column) => sheet.getRow(row).getCell(column).value ?? null);

function findRows(sheet: ExcelJS.Worksheet, label: string): number[] {
  const rows: number[] = [];

  sheet.eachRow((row, index) => {
    if (row.getCell(1).value === label) {
      rows.push(index);
    }
  });

  return rows;
}

describe("buildBillingWorkbook", () => {
  it("writes one sheet named Billing with the number, location, site and period", async () => {
    const workbook = await load(model);
    const sheet = workbook.getWorksheet("Billing")!;
    const text = (sheet.getCell("A1").value as string) ?? "";

    expect(workbook.worksheets.map((entry) => entry.name)).toEqual(["Billing"]);
    expect(text).toContain("BL-JKT-202611-0001");

    const header: string[] = [];

    sheet.eachRow((row) => {
      header.push(row.values ? (row.values as unknown[]).join("|") : "");
    });

    expect(header.join("\n")).toContain("Kejayan");
    expect(header.join("\n")).toContain("Jakarta");
    expect(header.join("\n")).toContain("1 Nov 2026 to 30 Nov 2026");
  });

  it("has the header row PO, Department, Sub-department, Position, Days", async () => {
    const sheet = (await load(model)).getWorksheet("Billing")!;
    const [first] = findRows(sheet, "PO");

    expect(rowValues(sheet, first)).toEqual(["PO", "Department", "Sub-department", "Position", "Days"]);
  });

  it("lists the lines of each PO, an empty cell for a missing sub-department, then a Subtotal", async () => {
    const sheet = (await load(model)).getWorksheet("Billing")!;
    const [header] = findRows(sheet, "PO");

    expect(rowValues(sheet, header + 1)).toEqual(["PO-A", "Produksi", "Press", "Operator", 3]);
    expect(rowValues(sheet, header + 2)).toEqual(["PO-A", "Produksi", null, "Helper", 2]);
    expect(rowValues(sheet, header + 3)).toEqual(["Subtotal", null, null, null, 5]);
    expect(rowValues(sheet, header + 4)).toEqual(["PO-B", "Produksi", null, "Operator", 2]);
    expect(rowValues(sheet, header + 5)).toEqual(["Subtotal", null, null, null, 2]);
    expect(findRows(sheet, "Subtotal")).toHaveLength(2);
  });

  it("ends with a Total days row", async () => {
    const sheet = (await load(model)).getWorksheet("Billing")!;

    expect(rowValues(sheet, sheet.rowCount)).toEqual(["Total days", null, null, null, 7]);
  });

  it("still gives a valid workbook when there are no groups", async () => {
    const sheet = (await load({ ...model, groups: { pos: [], totalDays: 0 } })).getWorksheet("Billing")!;

    expect(rowValues(sheet, sheet.rowCount)).toEqual(["Total days", null, null, null, 0]);
    expect(findRows(sheet, "Subtotal")).toHaveLength(0);
  });
});

describe("billingExportFileName", () => {
  it("lowercases the number and turns other characters into single hyphens", () => {
    expect(billingExportFileName("BL-JKT-202611-0001")).toBe("billing-bl-jkt-202611-0001.xlsx");
    expect(billingExportFileName(" BL/JKT  2026__11 ")).toBe("billing-bl-jkt-2026-11.xlsx");
  });
});
