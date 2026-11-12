import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { ExportBand, ExportModel, ExportWorkerLine } from "@/types/attendance-export";
import { buildExportWorkbook } from "./attendance-export-file";

// The positions below are those of the printed template (Schedule Weekly & Daily): the first form
// starts in column B, the second in N, the third in Z, and the first band's title is in row 3.

const worker = (index: number, overrides: Partial<ExportWorkerLine> = {}): ExportWorkerLine => ({
  employeeId: `EMP-${String(index).padStart(3, "0")}`,
  name: `Worker ${index}`,
  position: "Operator",
  ...overrides,
});

const band = (overrides: Partial<ExportBand> = {}): ExportBand => ({
  shiftLabels: ["S1", "S2"],
  forms: [
    { shiftOrder: 1, workers: [worker(1, { employeeId: "00123", name: "Budi" })] },
    { shiftOrder: 2, workers: [worker(2)] },
  ],
  requestRows: [
    { position: "Helper", counts: [null, 1] },
    { position: "Operator", counts: [2, null] },
  ],
  total: [2, 1],
  ...overrides,
});

const model = (bands: ExportBand[], weekday = "Senin", date = "2026-11-09"): ExportModel => ({
  title: "ABSENSI DAILY HELPER KEJAYAN",
  emptyMessage: null,
  sheets: [
    {
      name: "Form Absensi Papan Produksi",
      department: "Produksi",
      days: [{ date, weekday, bands }],
    },
    {
      name: "Form Absensi Papan Gudang",
      department: "Gudang",
      days: [{ date, weekday, bands: [band({ forms: [{ shiftOrder: 1, workers: [] }], shiftLabels: ["S1"], requestRows: [], total: [null] })] }],
    },
  ],
});

async function load(input: ExportModel) {
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load((await buildExportWorkbook(input)) as unknown as ArrayBuffer);

  return workbook;
}

const merges = (sheet: ExcelJS.Worksheet) => (sheet.model as { merges: string[] }).merges;

describe("buildExportWorkbook", () => {
  it("writes one sheet per department with the model's names, within Excel's limit", async () => {
    const workbook = await load(model([band()]));

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Form Absensi Papan Produksi",
      "Form Absensi Papan Gudang",
    ]);
    expect(workbook.worksheets.every((sheet) => sheet.name.length <= 31)).toBe(true);
  });

  it("sets up the page like the template: A4 portrait at 65 percent, no gridlines", async () => {
    const sheet = (await load(model([band()]))).worksheets[0];

    expect(sheet.pageSetup.paperSize).toBe(9);
    expect(sheet.pageSetup.orientation).toBe("portrait");
    expect(sheet.pageSetup.scale).toBe(65);
    expect(sheet.pageSetup.margins?.left).toBeCloseTo(0.236, 2);
    expect(sheet.pageSetup.margins?.top).toBeCloseTo(0.748, 2);
    expect(sheet.views[0]?.showGridLines).toBe(false);
  });

  it("uses the template's column widths for each form, three forms across", async () => {
    const sheet = (await load(model([band()]))).worksheets[0];
    const width = (letter: string) => sheet.getColumn(letter).width;

    expect(width("A")).toBeCloseTo(2.14, 1);
    expect(width("B")).toBeCloseTo(3.71, 1);
    expect(width("C")).toBeCloseTo(16, 1);
    expect(width("D")).toBeCloseTo(25.71, 1);
    expect(width("G")).toBeCloseTo(1.14, 1);
    expect(width("H")).toBeCloseTo(4.14, 1);
    // The second form repeats the same widths twelve columns on.
    expect(width("N")).toBeCloseTo(3.71, 1);
    expect(width("P")).toBeCloseTo(25.71, 1);
  });

  it("writes the title across each form in row 3, centred", async () => {
    const sheet = (await load(model([band()]))).worksheets[0];

    expect(sheet.getCell("B3").value).toBe("ABSENSI DAILY HELPER KEJAYAN");
    expect(sheet.getCell("N3").value).toBe("ABSENSI DAILY HELPER KEJAYAN");
    expect(merges(sheet)).toEqual(expect.arrayContaining(["B3:L3", "N3:X3"]));
    expect(sheet.getRow(3).height).toBeCloseTo(31.8, 1);
  });

  it("writes Tanggal as a real date, then Hari, Shift, and Area", async () => {
    const sheet = (await load(model([band()]))).worksheets[0];

    expect(sheet.getCell("B5").value).toBe("Tanggal");
    expect(sheet.getCell("D5").value).toBe(":");
    expect((sheet.getCell("E5").value as Date).toISOString().slice(0, 10)).toBe("2026-11-09");
    expect(sheet.getCell("E5").numFmt).toContain("dddd");
    expect(sheet.getCell("B6").value).toBe("Hari");
    expect(sheet.getCell("E6").value).toBe("Senin");
    expect(sheet.getCell("B7").value).toBe("Shift");
    expect(sheet.getCell("E7").value).toBe(1);
    expect(sheet.getCell("Q7").value).toBe(2);
    expect(sheet.getCell("B8").value).toBe("Area");
    expect(sheet.getCell("E8").value).toBe("Produksi");
  });

  it("writes the numbered slots: 1 to 20 on the left, 21 to 40 on the right", async () => {
    const sheet = (await load(model([band()]))).worksheets[0];

    expect(["B11", "C11", "D11", "E11", "F11"].map((ref) => sheet.getCell(ref).value)).toEqual([
      "NO",
      "ID",
      "NAMA",
      "AREA",
      "SIGN",
    ]);
    expect(["H11", "I11", "J11", "K11", "L11"].map((ref) => sheet.getCell(ref).value)).toEqual([
      "NO",
      "ID",
      "NAMA",
      "AREA",
      "SIGN",
    ]);
    expect(sheet.getCell("B12").value).toBe(1);
    expect(sheet.getCell("B31").value).toBe(20);
    expect(sheet.getCell("H12").value).toBe(21);
    expect(sheet.getCell("H31").value).toBe(40);
    expect(sheet.getRow(12).height).toBeCloseTo(24.6, 1);
  });

  it("fills the slots with the workers, the ID as text, and leaves SIGN empty", async () => {
    const sheet = (await load(model([band()]))).worksheets[0];

    expect(sheet.getCell("C12").value).toBe("00123");
    expect(typeof sheet.getCell("C12").value).toBe("string");
    expect(sheet.getCell("D12").value).toBe("Budi");
    expect(sheet.getCell("E12").value).toBe("Operator");
    expect(sheet.getCell("F12").value).toBeNull();
    expect(sheet.getCell("C13").value).toBeNull();
    // The second form has its own worker, twelve columns on.
    expect(sheet.getCell("O12").value).toBe("EMP-002");
  });

  it("adds slot rows when a form has more than 40 workers, continuing the numbers", async () => {
    const many = Array.from({ length: 45 }, (_, index) => worker(index + 1));
    const sheet = (
      await load(
        model([
          band({
            shiftLabels: ["S1"],
            forms: [{ shiftOrder: 1, workers: many }],
            requestRows: [],
            total: [null],
          }),
        ]),
      )
    ).worksheets[0];

    // 45 workers need 23 rows per column: left 1 to 23, right 24 to 46.
    expect(sheet.getCell("B34").value).toBe(23);
    expect(sheet.getCell("H12").value).toBe(24);
    expect(sheet.getCell("H34").value).toBe(46);
    expect(sheet.getCell("C12").value).toBe("EMP-001");
    expect(sheet.getCell("I12").value).toBe("EMP-024");
    expect(sheet.getCell("I33").value).toBe("EMP-045");
  });

  it("writes the request table under the slots: REQUEST, ACTUAL, ADD, positions, TOTAL", async () => {
    const sheet = (await load(model([band()]))).worksheets[0];

    expect(sheet.getCell("C33").value).toBe("Produksi");
    expect(sheet.getCell("D33").value).toBe("REQUEST");
    expect(sheet.getCell("I33").value).toBe("ACTUAL");
    expect(sheet.getCell("L33").value).toBe("ADD");
    expect(merges(sheet)).toEqual(expect.arrayContaining(["D33:E33", "I33:J33", "L33:L34"]));
    expect(["C34", "D34", "E34", "I34", "J34"].map((ref) => sheet.getCell(ref).value)).toEqual([
      "Position",
      "Senin S1",
      "Senin S2",
      "Senin S1",
      "Senin S2",
    ]);
    expect(["C35", "D35", "E35", "I35", "J35", "L35"].map((ref) => sheet.getCell(ref).value)).toEqual(
      ["Helper", null, 1, null, null, null],
    );
    expect(["C36", "D36", "E36"].map((ref) => sheet.getCell(ref).value)).toEqual([
      "Operator",
      2,
      null,
    ]);
    expect(["C37", "D37", "E37"].map((ref) => sheet.getCell(ref).value)).toEqual(["TOTAL", 2, 1]);
  });

  it("closes a band with the Prepared By and FLM / SO block", async () => {
    const sheet = (await load(model([band()]))).worksheets[0];

    expect(sheet.getCell("C39").value).toBe("Prepared By,");
    expect(sheet.getCell("I39").value).toBe("FLM / SO");
    expect(String(sheet.getCell("C43").value).trim().startsWith("(")).toBe(true);
  });

  it("starts the next band two rows below the signature line", async () => {
    const sheet = (
      await load(
        model([
          band(),
          band({ shiftLabels: ["S4"], forms: [{ shiftOrder: 4, workers: [] }], requestRows: [], total: [null] }),
        ]),
      )
    ).worksheets[0];

    // The first band ends with the signature line in row 43, and the next title is in row 45.
    expect(sheet.getCell("B45").value).toBe("ABSENSI DAILY HELPER KEJAYAN");
    expect(sheet.getCell("E49").value).toBe(4);
  });

  it("puts a page break after each band but the last", async () => {
    const bytes = await buildExportWorkbook(
      model([
        band(),
        band({ shiftLabels: ["S4"], forms: [{ shiftOrder: 4, workers: [] }], requestRows: [], total: [null] }),
      ]),
    );
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    const breaks = [...xml.matchAll(/<brk id="(\d+)"/g)].map((match) => Number(match[1]));

    expect(breaks).toEqual([44]);
  });

  it("gives one sheet with the message when the week has nothing to export", async () => {
    const workbook = await load({
      title: "ABSENSI DAILY HELPER KEJAYAN",
      sheets: [],
      emptyMessage: "Tidak ada roster confirmed untuk 2026-11-09 sampai 2026-11-15.",
    });

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Tidak ada jadwal"]);
    expect(workbook.worksheets[0].getCell("A1").value).toBe(
      "Tidak ada roster confirmed untuk 2026-11-09 sampai 2026-11-15.",
    );
  });
});
