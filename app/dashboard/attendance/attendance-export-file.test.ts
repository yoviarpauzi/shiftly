import readXlsxFile, { readSheet } from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import type { ExportForm, ExportModel } from "@/types/attendance-export";
import { buildExportWorkbook } from "./attendance-export-file";

const form = (overrides: Partial<ExportForm> = {}): ExportForm => ({
  date: "2026-11-09",
  weekday: "Senin",
  shiftOrder: 1,
  shiftLabels: ["S1", "S2"],
  workers: [{ no: 1, employeeId: "00123", name: "Budi", position: "Operator" }],
  requestRows: [
    { position: "Helper", counts: [null, 1] },
    { position: "Operator", counts: [2, null] },
  ],
  total: [2, 1],
  ...overrides,
});

const MODEL: ExportModel = {
  title: "Absensi Daily Helper Kejayan",
  emptyMessage: null,
  sheets: [
    { name: "Form Absensi Papan Produksi", department: "Produksi", forms: [form()] },
    {
      name: "Form Absensi Papan Gudang",
      department: "Gudang",
      forms: [
        form({ shiftOrder: 1, workers: [] }),
        form({
          date: "2026-11-10",
          weekday: "Selasa",
          shiftOrder: 2,
          workers: [{ no: 1, employeeId: "EMP-9", name: "Citra", position: "Helper" }],
        }),
      ],
    },
  ],
};

type Rows = (string | number | boolean | Date | null | undefined)[][];

const cell = (rows: Rows, row: number, column: number) => rows[row]?.[column] ?? null;

const rowWhere = (rows: Rows, column: number, value: string, from = 0) =>
  rows.findIndex((row, index) => index >= from && row?.[column] === value);

describe("buildExportWorkbook", () => {
  it("writes one sheet per department with the model's name, within Excel's limit", async () => {
    const sheets = await readXlsxFile(await buildExportWorkbook(MODEL));

    expect(sheets.map((sheet) => sheet.sheet)).toEqual([
      "Form Absensi Papan Produksi",
      "Form Absensi Papan Gudang",
    ]);
    expect(sheets.every((sheet) => sheet.sheet.length <= 31)).toBe(true);
  });

  it("writes the title, the date, the weekday, and the department of a form", async () => {
    const rows = (await readSheet(
      await buildExportWorkbook(MODEL),
      "Form Absensi Papan Produksi",
    )) as Rows;

    expect(cell(rows, 0, 0)).toBe("Absensi Daily Helper Kejayan");
    expect(cell(rows, 1, 0)).toBe("Tanggal: 2026-11-09");
    expect(cell(rows, 1, 2)).toBe("Hari: Senin");
    expect(cell(rows, 1, 3)).toBe("Area: Produksi");
  });

  it("writes the worker table with the ID as text and SIGN empty", async () => {
    const rows = (await readSheet(
      await buildExportWorkbook(MODEL),
      "Form Absensi Papan Produksi",
    )) as Rows;
    const header = rowWhere(rows, 0, "NO");

    expect([0, 1, 2, 3, 4].map((column) => cell(rows, header, column))).toEqual([
      "NO",
      "ID",
      "NAMA",
      "AREA",
      "SIGN",
    ]);
    expect([0, 1, 2, 3, 4].map((column) => cell(rows, header + 1, column))).toEqual([
      1,
      "00123",
      "Budi",
      "Operator",
      null,
    ]);
    expect(typeof cell(rows, header + 1, 1)).toBe("string");
  });

  it("writes the request table with empty actual and ADD cells, and the total", async () => {
    const rows = (await readSheet(
      await buildExportWorkbook(MODEL),
      "Form Absensi Papan Produksi",
    )) as Rows;
    const group = rows.findIndex((row) => row?.[3] === "REQUEST");

    expect(cell(rows, group, 3)).toBe("REQUEST");
    expect(cell(rows, group, 5)).toBe("ACTUAL");
    expect(cell(rows, group, 7)).toBe("ADD");
    expect([0, 3, 4, 5, 6, 7].map((column) => cell(rows, group + 1, column))).toEqual([
      "Position",
      "S1",
      "S2",
      "S1",
      "S2",
      null,
    ]);
    // Helper has a request on S2 only, Operator on S1 only. Actual and ADD stay empty.
    expect([0, 3, 4, 5, 6, 7].map((column) => cell(rows, group + 2, column))).toEqual([
      "Helper",
      null,
      1,
      null,
      null,
      null,
    ]);
    expect([0, 3, 4, 5, 6, 7].map((column) => cell(rows, group + 3, column))).toEqual([
      "Operator",
      2,
      null,
      null,
      null,
      null,
    ]);
    expect([0, 3, 4].map((column) => cell(rows, group + 4, column))).toEqual(["TOTAL", 2, 1]);
  });

  it("stacks the forms of a sheet in order, with the form's own day and worker", async () => {
    const rows = (await readSheet(
      await buildExportWorkbook(MODEL),
      "Form Absensi Papan Gudang",
    )) as Rows;
    const firstTitle = rowWhere(rows, 0, "Absensi Daily Helper Kejayan");
    const secondTitle = rowWhere(rows, 0, "Absensi Daily Helper Kejayan", firstTitle + 1);

    expect(secondTitle).toBeGreaterThan(firstTitle);
    expect(cell(rows, secondTitle + 1, 0)).toBe("Tanggal: 2026-11-10");
    expect(cell(rows, secondTitle + 1, 2)).toBe("Hari: Selasa");
    expect(rowWhere(rows, 1, "EMP-9", secondTitle)).toBeGreaterThan(secondTitle);
  });

  it("gives one sheet with the message when the week has nothing to export", async () => {
    const empty: ExportModel = {
      title: "Absensi Daily Helper Kejayan",
      sheets: [],
      emptyMessage: "Tidak ada roster confirmed untuk 2026-11-09 sampai 2026-11-15.",
    };
    const sheets = await readXlsxFile(await buildExportWorkbook(empty));

    expect(sheets.map((sheet) => sheet.sheet)).toEqual(["Tidak ada jadwal"]);
    expect(cell(sheets[0].data as Rows, 0, 0)).toBe(
      "Tidak ada roster confirmed untuk 2026-11-09 sampai 2026-11-15.",
    );
  });
});
