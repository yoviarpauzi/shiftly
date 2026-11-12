import { describe, expect, it } from "vitest";
import type { ExportAssignmentRow, ExportInput, ExportTargetRow } from "@/types/attendance-export";
import {
  buildExportModel,
  exportFileName,
  exportSheetName,
  weekBounds,
  weekdayNameId,
} from "./attendance-export-rules";

describe("weekBounds", () => {
  it("runs Monday to Sunday around a Wednesday", () => {
    expect(weekBounds("2026-11-11")).toEqual({ from: "2026-11-09", to: "2026-11-15" });
  });

  it("starts a Monday on itself", () => {
    expect(weekBounds("2026-11-09")).toEqual({ from: "2026-11-09", to: "2026-11-15" });
  });

  it("puts a Sunday in the week that began the Monday before", () => {
    expect(weekBounds("2026-11-15")).toEqual({ from: "2026-11-09", to: "2026-11-15" });
  });

  it("crosses a year end", () => {
    expect(weekBounds("2026-12-30")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
  });

  it("crosses 29 February", () => {
    expect(weekBounds("2028-02-29")).toEqual({ from: "2028-02-28", to: "2028-03-05" });
  });
});

describe("weekdayNameId", () => {
  it("names the days in Indonesian", () => {
    expect(weekdayNameId("2026-11-09")).toBe("Senin");
    expect(weekdayNameId("2026-11-15")).toBe("Minggu");
  });
});

describe("exportSheetName", () => {
  it("prefixes the department", () => {
    expect(exportSheetName("HSE", new Set())).toBe("Form Absensi Papan HSE");
  });

  it("removes the characters Excel rejects", () => {
    expect(exportSheetName("A[1]:B*C?D/E\\F", new Set())).toBe("Form Absensi Papan A1BCDEF");
  });

  it("cuts a long name to 31 characters and drops a space the cut leaves at the end", () => {
    const name = exportSheetName("A very long department name indeed", new Set());

    expect(name.length).toBeLessThanOrEqual(31);
    expect(name).toBe("Form Absensi Papan A very long");
  });

  it("numbers a clash and keeps it within 31 characters", () => {
    const first = exportSheetName("A very long department name indeed", new Set());
    const second = exportSheetName("A very long department name indeed", new Set([first]));

    expect(second).not.toBe(first);
    expect(second).toHaveLength(31);
    expect(second.endsWith(" 2")).toBe(true);
  });

  it("never ends the name with an apostrophe, which Excel rejects", () => {
    expect(exportSheetName("Helpers'", new Set())).toBe("Form Absensi Papan Helpers");
    expect(exportSheetName("Abcdefghijk' xyz", new Set())).toBe("Form Absensi Papan Abcdefghijk");
    expect(exportSheetName("Helpers'", new Set(["Form Absensi Papan Helpers"]))).toBe(
      "Form Absensi Papan Helpers 2",
    );
  });

  it("treats names as equal whatever their case, like Excel", () => {
    const second = exportSheetName("hse", new Set(["Form Absensi Papan HSE"]));

    expect(second).toBe("Form Absensi Papan hse 2");
  });

  it("never returns a name that is taken", () => {
    const taken = new Set(["Form Absensi Papan HSE", "Form Absensi Papan HSE 2"]);

    expect(taken.has(exportSheetName("HSE", taken))).toBe(false);
  });
});

describe("exportFileName", () => {
  it("builds the name from the location and the week", () => {
    expect(exportFileName("Kejayan Factory", "2026-11-09", "2026-11-15")).toBe(
      "absensi-kejayan-factory-2026-11-09-2026-11-15.xlsx",
    );
  });

  it("falls back to lokasi when the name has no letters or digits", () => {
    expect(exportFileName("***", "2026-11-09", "2026-11-15")).toBe(
      "absensi-lokasi-2026-11-09-2026-11-15.xlsx",
    );
  });
});

const D1 = "2026-11-09";
const D2 = "2026-11-10";

const assignment = (overrides: Partial<ExportAssignmentRow> = {}): ExportAssignmentRow => ({
  employeeId: "EMP-001",
  workerName: "Budi",
  departmentId: "dA",
  departmentName: "Produksi",
  positionId: "p1",
  positionName: "Operator",
  date: D1,
  shiftId: "s1",
  shiftOrder: 1,
  ...overrides,
});

const target = (overrides: Partial<ExportTargetRow> = {}): ExportTargetRow => ({
  departmentId: "dA",
  departmentName: "Produksi",
  positionId: "p1",
  positionName: "Operator",
  date: D1,
  shiftId: "s1",
  shiftOrder: 1,
  headcount: 2,
  ...overrides,
});

const input = (overrides: Partial<ExportInput> = {}): ExportInput => ({
  locationName: "Kejayan",
  from: "2026-11-09",
  to: "2026-11-15",
  shifts: [
    { id: "s2", order: 2 },
    { id: "s1", order: 1 },
  ],
  assignments: [],
  targets: [],
  ...overrides,
});

describe("buildExportModel", () => {
  it("gives the title in capitals, and an empty message when there is nothing", () => {
    const model = buildExportModel(input());

    expect(model.title).toBe("ABSENSI DAILY HELPER KEJAYAN");
    expect(model.sheets).toEqual([]);
    expect(model.emptyMessage).toBe("Tidak ada roster confirmed untuk 2026-11-09 sampai 2026-11-15.");
  });

  it("makes one sheet per department with rows, ordered by name", () => {
    const model = buildExportModel(
      input({
        assignments: [
          assignment(),
          assignment({ departmentId: "dB", departmentName: "Gudang", employeeId: "EMP-002" }),
        ],
        targets: [target({ departmentId: "dC", departmentName: "Kosong", date: D1, headcount: 0 })],
      }),
    );

    expect(model.emptyMessage).toBeNull();
    expect(model.sheets.map((sheet) => sheet.department)).toEqual(["Gudang", "Produksi"]);
    expect(model.sheets.map((sheet) => sheet.name)).toEqual([
      "Form Absensi Papan Gudang",
      "Form Absensi Papan Produksi",
    ]);
  });

  it("makes one day per date with rows, in date order, with the Indonesian weekday", () => {
    const [sheet] = buildExportModel(
      input({
        assignments: [assignment({ date: D2 }), assignment({ date: D1 })],
      }),
    ).sheets;

    expect(sheet.days.map((day) => [day.date, day.weekday])).toEqual([
      [D1, "Senin"],
      [D2, "Selasa"],
    ]);
  });

  it("puts the forms of a day side by side, one per shift that has a worker or a headcount", () => {
    const [sheet] = buildExportModel(
      input({
        shifts: [
          { id: "s1", order: 1 },
          { id: "s2", order: 2 },
          { id: "s3", order: 3 },
        ],
        assignments: [
          assignment({ shiftId: "s3", shiftOrder: 3 }),
          assignment({ employeeId: "EMP-002", shiftId: "s1", shiftOrder: 1 }),
        ],
        targets: [target({ shiftId: "s2", shiftOrder: 2, headcount: 1 })],
      }),
    ).sheets;
    const [band] = sheet.days[0].bands;

    expect(sheet.days[0].bands).toHaveLength(1);
    expect(band.shiftLabels).toEqual(["S1", "S2", "S3"]);
    expect(band.forms.map((form) => form.shiftOrder)).toEqual([1, 2, 3]);
  });

  it("writes no form for a shift with neither a worker nor a headcount", () => {
    const [sheet] = buildExportModel(
      input({
        shifts: [
          { id: "s1", order: 1 },
          { id: "s2", order: 2 },
          { id: "s3", order: 3 },
        ],
        assignments: [assignment({ shiftId: "s1", shiftOrder: 1 })],
        targets: [target({ shiftId: "s3", shiftOrder: 3, headcount: 0 })],
      }),
    ).sheets;
    const [band] = sheet.days[0].bands;

    expect(band.shiftLabels).toEqual(["S1"]);
    expect(band.forms.map((form) => form.shiftOrder)).toEqual([1]);
  });

  it("moves a fourth shift to a second band with its own request columns", () => {
    const [sheet] = buildExportModel(
      input({
        shifts: [
          { id: "s1", order: 1 },
          { id: "s2", order: 2 },
          { id: "s3", order: 3 },
          { id: "s4", order: 4 },
        ],
        assignments: [1, 2, 3, 4].map((order) =>
          assignment({ employeeId: `EMP-00${order}`, shiftId: `s${order}`, shiftOrder: order }),
        ),
        targets: [target({ shiftId: "s4", shiftOrder: 4, headcount: 2 })],
      }),
    ).sheets;
    const [first, second] = sheet.days[0].bands;

    expect(first.shiftLabels).toEqual(["S1", "S2", "S3"]);
    expect(second.shiftLabels).toEqual(["S4"]);
    expect(second.forms.map((form) => form.shiftOrder)).toEqual([4]);
    expect(second.requestRows).toEqual([{ position: "Operator", counts: [2] }]);
  });

  it("orders workers by position, then name, then employee ID", () => {
    const [sheet] = buildExportModel(
      input({
        assignments: [
          assignment({ employeeId: "EMP-003", workerName: "Citra", positionName: "Operator" }),
          assignment({ employeeId: "EMP-002", workerName: "Budi", positionName: "Operator" }),
          assignment({ employeeId: "EMP-001", workerName: "Budi", positionName: "Helper", positionId: "p2" }),
          assignment({ employeeId: "EMP-000", workerName: "Budi", positionName: "Operator" }),
        ],
      }),
    ).sheets;

    expect(sheet.days[0].bands[0].forms[0].workers).toEqual([
      { employeeId: "EMP-001", name: "Budi", position: "Helper" },
      { employeeId: "EMP-000", name: "Budi", position: "Operator" },
      { employeeId: "EMP-002", name: "Budi", position: "Operator" },
      { employeeId: "EMP-003", name: "Citra", position: "Operator" },
    ]);
  });

  it("builds the request table per position and shift of the band, with totals", () => {
    const [sheet] = buildExportModel(
      input({
        assignments: [assignment({ date: D1, shiftId: "s1", shiftOrder: 1 })],
        targets: [
          target({ date: D1, shiftId: "s1", shiftOrder: 1, headcount: 2 }),
          target({ date: D1, shiftId: "s2", shiftOrder: 2, headcount: 1 }),
          target({ date: D1, positionId: "p2", positionName: "Helper", shiftId: "s1", shiftOrder: 1, headcount: 1 }),
          target({ date: D2, shiftId: "s2", shiftOrder: 2, headcount: 4 }),
        ],
      }),
    ).sheets;
    const [band] = sheet.days.find((day) => day.date === D1)!.bands;

    expect(band.requestRows).toEqual([
      { position: "Helper", counts: [1, null] },
      { position: "Operator", counts: [2, 1] },
    ]);
    expect(band.total).toEqual([3, 1]);
  });

  it("leaves a total of zero empty", () => {
    const [sheet] = buildExportModel(
      input({
        assignments: [assignment({ date: D2, shiftId: "s1", shiftOrder: 1 })],
        targets: [target({ date: D1, shiftId: "s1", shiftOrder: 1, headcount: 2 })],
      }),
    ).sheets;
    const [band] = sheet.days.find((day) => day.date === D2)!.bands;

    expect(band.total).toEqual([null]);
  });
});
