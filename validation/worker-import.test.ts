import { describe, expect, it } from "vitest";
import {
  checkImportFileBytes,
  checkImportFileMeta,
  checkImportHeaders,
  IMPORT_MAX_BYTES,
} from "./worker-import";

describe("checkImportFileMeta", () => {
  it("accepts a .xlsx file at the size limit", () => {
    expect(checkImportFileMeta({ name: "w.xlsx", size: IMPORT_MAX_BYTES })).toBeNull();
  });

  it("rejects a file over the limit", () => {
    expect(checkImportFileMeta({ name: "w.xlsx", size: IMPORT_MAX_BYTES + 1 })).toContain("1 MB");
  });

  it("rejects other extensions and ignores the case of .XLSX", () => {
    expect(checkImportFileMeta({ name: "w.csv", size: 10 })).toContain(".xlsx");
    expect(checkImportFileMeta({ name: "W.XLSX", size: 10 })).toBeNull();
  });

  it("rejects an empty file", () => {
    expect(checkImportFileMeta({ name: "w.xlsx", size: 0 })).not.toBeNull();
  });
});

describe("checkImportFileBytes", () => {
  it("accepts the zip signature", () => {
    expect(checkImportFileBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
  });

  it("rejects a PDF signature", () => {
    expect(checkImportFileBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).not.toBeNull();
  });

  it("rejects empty bytes", () => {
    expect(checkImportFileBytes(new Uint8Array([]))).not.toBeNull();
  });
});

describe("checkImportHeaders", () => {
  it("accepts the headers in any order and case", () => {
    const result = checkImportHeaders(["Positions", " NAME ", "site", "Location", "employee_id"]);

    expect(result).toEqual({
      ok: true,
      columnIndex: { positions: 0, name: 1, site: 2, location: 3, employee_id: 4 },
    });
  });

  it("names the missing headers", () => {
    const result = checkImportHeaders(["employee_id", "name"]);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.formError).toContain("site, location, positions");
    }
  });

  it("ignores extra unknown columns", () => {
    const result = checkImportHeaders(["employee_id", "name", "site", "location", "positions", "notes"]);

    expect(result.ok).toBe(true);
  });

  it("treats non-string header cells as unknown", () => {
    const result = checkImportHeaders([1, null, true, new Date(0)]);

    expect(result.ok).toBe(false);
  });
});
