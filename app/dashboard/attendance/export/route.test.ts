import readXlsxFile from "read-excel-file/node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceAccess } from "@/types/attendance";
import type { ExportInput } from "@/types/attendance-export";

const ACCESS: AttendanceAccess = {
  userId: "u-1",
  role: "superadmin",
  siteId: null,
  locationId: null,
};

const loaded = vi.hoisted(() => ({ input: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("../attendance-guard", () => ({ requireAttendanceAccess: async () => ACCESS }));
vi.mock("../attendance-export", () => ({
  loadExportInput: vi.fn(async () => loaded.input),
}));

const { GET } = await import("./route");
const { loadExportInput } = await import("../attendance-export");

const LOCATION = "33333333-3333-4333-8333-333333333331";

const request = (query: string) => new Request(`http://localhost/dashboard/attendance/export?${query}`);

const withRows: ExportInput = {
  locationName: "Kejayan",
  from: "2026-11-09",
  to: "2026-11-15",
  shifts: [{ id: "s1", order: 1 }],
  assignments: [
    {
      employeeId: "00123",
      workerName: "Budi",
      departmentId: "dA",
      departmentName: "Produksi",
      positionId: "p1",
      positionName: "Operator",
      date: "2026-11-09",
      shiftId: "s1",
      shiftOrder: 1,
    },
  ],
  targets: [],
};

beforeEach(() => {
  vi.mocked(loadExportInput).mockClear();
  loaded.input = withRows;
});

describe("GET /dashboard/attendance/export", () => {
  it("gives a 404 for a bad location or date, before reading anything", async () => {
    await expect(GET(request("date=2026-11-11"))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(GET(request(`location=abc&date=2026-11-11`))).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(GET(request(`location=${LOCATION}&date=abc`))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(loadExportInput).not.toHaveBeenCalled();
  });

  it("gives a 404 when the location is missing or outside the access", async () => {
    loaded.input = null;

    await expect(GET(request(`location=${LOCATION}&date=2026-11-11`))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("reads the Monday to Sunday week of the date for the location", async () => {
    await GET(request(`location=${LOCATION}&date=2026-11-11`));

    expect(loadExportInput).toHaveBeenCalledWith(ACCESS, LOCATION, "2026-11-09", "2026-11-15");
  });

  it("answers with an xlsx attachment named for the location and the week, never cached", async () => {
    const response = await GET(request(`location=${LOCATION}&date=2026-11-11`));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="absensi-kejayan-2026-11-09-2026-11-15.xlsx"',
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns a workbook with the department's sheet", async () => {
    const response = await GET(request(`location=${LOCATION}&date=2026-11-11`));
    const sheets = await readXlsxFile(Buffer.from(await response.arrayBuffer()));

    expect(sheets.map((sheet) => sheet.sheet)).toEqual(["Form Absensi Papan Produksi"]);
  });

  it("returns a workbook that says so when the week has nothing", async () => {
    loaded.input = { ...withRows, assignments: [], targets: [] };

    const response = await GET(request(`location=${LOCATION}&date=2026-11-11`));
    const sheets = await readXlsxFile(Buffer.from(await response.arrayBuffer()));

    expect(sheets.map((sheet) => sheet.sheet)).toEqual(["Tidak ada jadwal"]);
  });
});
