import writeXlsxFile, { type SheetData } from "write-excel-file/node";
import { describe, expect, it } from "vitest";
import { IMPORT_MAX_EXPANDED_BYTES, IMPORT_MAX_ROWS } from "@/validation/worker-import";
import { fakeZip } from "@/validation/zip-fixture";
import { readSheet } from "read-excel-file/node";
import type { ImportLookups } from "@/types/worker-import";
import { resolveImportRows } from "./worker-import";
import { buildImportTemplate, readImportSheet } from "./worker-import-file";

const HEADER = ["employee_id", "name", "site", "location", "positions", "end_contract"];

// A cell with only a text format, like the empty rows Excel keeps below a formatted table.
const BLANK = { type: String, format: "@" };
const BLANK_ROW = [BLANK, BLANK, BLANK, BLANK, BLANK, BLANK];

function xlsx(rows: SheetData) {
  return writeXlsxFile(rows).toBuffer();
}

describe("readImportSheet", () => {
  it("reads rows with their Excel row numbers, even when the headers are reordered", async () => {
    const bytes = await xlsx([
      ["positions", "end_contract", "name", "site", "location", "employee_id"],
      ["Operator", "2026-12-31", "Budi", "Alpha", "Gudang", "EMP-1"],
      [null, "2027-01-31", "Sari", "Alpha", "Kantor", "EMP-2"],
    ]);

    const result = await readImportSheet(bytes);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.rows.map((row) => row.rowNumber)).toEqual([2, 3]);
      expect(result.rows[0].cells).toEqual({
        employee_id: "EMP-1",
        name: "Budi",
        site: "Alpha",
        location: "Gudang",
        positions: "Operator",
        end_contract: "2026-12-31",
        work_days: null,
      });
      expect(result.rows[1].cells.positions).toBeNull();
    }
  });

  it("still reads a file from the old template, with no work_days column", async () => {
    const result = await readImportSheet(
      await xlsx([HEADER, ["EMP-1", "Budi", "Alpha", "Gudang", null, "2026-12-31"]]),
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.rows.every((row) => row.cells.work_days === null)).toBe(true);
    }
  });

  it("reads the work_days cell, wherever the column is", async () => {
    const result = await readImportSheet(
      await xlsx([
        ["work_days", ...HEADER],
        [7, "EMP-1", "Budi", "Alpha", "Gudang", null, "2026-12-31"],
        [null, "EMP-2", "Sari", "Alpha", "Gudang", null, "2026-12-31"],
        ["5", "EMP-3", "Dewi", "Alpha", "Gudang", null, "2026-12-31"],
      ]),
    );

    expect(result.ok && result.rows.map((row) => row.cells.work_days)).toEqual([7, null, "5"]);
  });

  it("keeps number cells as numbers", async () => {
    const result = await readImportSheet(await xlsx([HEADER, [12345, "Budi", "Alpha", "Gudang", null, "2026-12-31"]]));

    expect(result.ok && result.rows[0].cells.employee_id).toBe(12345);
  });

  it("skips blank rows, and they do not count toward the limit", async () => {
    const rows: SheetData = [HEADER];

    for (let index = 1; index <= 3; index += 1) {
      rows.push([`EMP-${index}`, "Budi", "Alpha", "Gudang", null, "2026-12-31"]);
      rows.push(BLANK_ROW);
    }

    for (let index = 0; index < 600; index += 1) {
      rows.push(BLANK_ROW);
    }

    const result = await readImportSheet(await xlsx(rows));

    expect(result.ok && result.rows.map((row) => row.rowNumber)).toEqual([2, 4, 6]);
  });

  it("rejects more rows than the limit", async () => {
    const rows: SheetData = [HEADER];

    for (let index = 1; index <= IMPORT_MAX_ROWS + 1; index += 1) {
      rows.push([`EMP-${index}`, "Budi", "Alpha", "Gudang", null, "2026-12-31"]);
    }

    const result = await readImportSheet(await xlsx(rows));

    expect(result).toEqual({ ok: false, formError: expect.stringContaining("500") });
  });

  it("accepts exactly the limit", async () => {
    const rows: SheetData = [HEADER];

    for (let index = 1; index <= IMPORT_MAX_ROWS; index += 1) {
      rows.push([`EMP-${index}`, "Budi", "Alpha", "Gudang", null, "2026-12-31"]);
    }

    const result = await readImportSheet(await xlsx(rows));

    expect(result.ok && result.rows).toHaveLength(IMPORT_MAX_ROWS);
  });

  it("rejects a sheet with a header and no workers", async () => {
    const result = await readImportSheet(await xlsx([HEADER, BLANK_ROW]));

    expect(result).toEqual({ ok: false, formError: "The file has no workers" });
  });

  it("rejects an empty sheet without throwing", async () => {
    const result = await readImportSheet(await xlsx([[]]));

    expect(result).toEqual({ ok: false, formError: "The file has no workers" });
  });

  it("names the missing columns", async () => {
    const result = await readImportSheet(await xlsx([["employee_id", "name"], ["EMP-1", "Budi"]]));

    expect(result).toEqual({
      ok: false,
      formError: "Missing columns: site, location, positions, end_contract",
    });
  });

  it("names a missing end_contract column", async () => {
    const result = await readImportSheet(
      await xlsx([HEADER.slice(0, 5), ["EMP-1", "Budi", "Alpha", "Gudang", null]]),
    );

    expect(result).toEqual({ ok: false, formError: "Missing columns: end_contract" });
  });

  it("reads a real Excel date cell back as the day typed", async () => {
    const lookups: ImportLookups = {
      sites: [{ id: "s1", name: "Alpha" }],
      locations: [{ id: "l1", siteId: "s1", name: "Gudang" }],
      positions: [],
      existing: [],
    };
    const bytes = await xlsx([
      HEADER,
      [
        "EMP-1",
        "Budi",
        "Alpha",
        "Gudang",
        null,
        { type: Date, value: new Date(Date.UTC(2026, 11, 31)), format: "yyyy-mm-dd" },
      ],
    ]);

    const sheet = await readImportSheet(bytes);

    expect(sheet.ok).toBe(true);

    if (sheet.ok) {
      expect(sheet.rows[0].cells.end_contract).toBeInstanceOf(Date);

      const [row] = resolveImportRows(sheet.rows, lookups, { siteId: null, locationId: null });

      expect(row).toMatchObject({ action: "create", endContract: "2026-12-31", errors: [] });
    }
  });

  it("rejects a workbook that would unzip past the limit before reading it", async () => {
    const result = await readImportSheet(Buffer.from(fakeZip([IMPORT_MAX_EXPANDED_BYTES + 1])));

    expect(result).toEqual({ ok: false, formError: "The file is too large once unzipped" });
  });

  it("rejects bytes that are not a workbook", async () => {
    const result = await readImportSheet(Buffer.from("PK not really"));

    expect(result).toEqual({ ok: false, formError: "The file is not a valid .xlsx workbook" });
  });
});

describe("buildImportTemplate", () => {
  it("reads back as the header and one example worker", async () => {
    const result = await readImportSheet(await buildImportTemplate());

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].cells.employee_id).toBe("EMP-001");
      expect(result.rows[0].cells.end_contract).toBeInstanceOf(Date);

      const lookups: ImportLookups = {
        sites: [{ id: "s1", name: "Alpha" }],
        locations: [{ id: "l1", siteId: "s1", name: "Gudang" }],
        positions: [
          { id: "p1", siteId: "s1", name: "Operator" },
          { id: "p2", siteId: "s1", name: "Driver" },
        ],
        existing: [],
      };
      const [row] = resolveImportRows(result.rows, lookups, { siteId: null, locationId: null });

      expect(row).toMatchObject({ action: "create", endContract: "2026-12-31", errors: [] });
    }
  });

  it("writes end_contract in the header", async () => {
    const [header] = await readSheet(await buildImportTemplate());

    expect(header).toContain("end_contract");
  });

  it("ends the header with the optional work_days column and gives the example worker 5", async () => {
    const [header, example] = await readSheet(await buildImportTemplate());

    expect(header.at(-1)).toBe("work_days");
    expect(example.at(-1)).toBe(5);
  });
});
