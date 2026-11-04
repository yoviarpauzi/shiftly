import { describe, expect, it, vi } from "vitest";

import type { AttendanceFilters } from "@/types/attendance";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

const { buildAttendanceList, resolveSelection } = await import("./attendance");

const filters = (overrides: Partial<AttendanceFilters> = {}): AttendanceFilters => ({
  date: "2026-11-09",
  siteId: null,
  locationId: null,
  departmentId: null,
  shiftId: null,
  status: "all",
  query: "",
  ...overrides,
});

const joined = (overrides: Record<string, unknown> = {}) => ({
  assignmentId: "a1",
  employeeId: "E-100",
  workerName: "Budi Santoso",
  departmentId: "d1",
  departmentName: "Produksi",
  positionName: "Operator",
  locationName: "Gudang Utara",
  siteName: "Site Utama",
  shiftId: "s1",
  shiftOrder: 1,
  shiftName: "Pagi",
  startTime: "07:00:00",
  endTime: "15:00:00",
  status: null,
  reason: null,
  ...overrides,
});

describe("buildAttendanceList", () => {
  it("gives a worker with no attendance row a null status", () => {
    const { rows } = buildAttendanceList([joined()], filters());

    expect(rows[0]).toMatchObject({ assignmentId: "a1", status: null, reason: null });
  });

  it("shows the shift times as hours and minutes", () => {
    const { rows } = buildAttendanceList([joined()], filters());

    expect(rows[0]).toMatchObject({ startTime: "07:00", endTime: "15:00" });
  });

  it("keeps only the workers with no row for the not-marked filter", () => {
    const { rows } = buildAttendanceList(
      [joined({ assignmentId: "a1" }), joined({ assignmentId: "a2", status: "present" })],
      filters({ status: "not-marked" }),
    );

    expect(rows.map((row) => row.assignmentId)).toEqual(["a1"]);
  });

  it("keeps only the workers with the chosen status", () => {
    const { rows } = buildAttendanceList(
      [
        joined({ assignmentId: "a1", status: "sick" }),
        joined({ assignmentId: "a2", status: "present" }),
      ],
      filters({ status: "sick" }),
    );

    expect(rows.map((row) => row.assignmentId)).toEqual(["a1"]);
  });

  it("filters by department and by shift", () => {
    const input = [
      joined({ assignmentId: "a1", departmentId: "d1", shiftId: "s1" }),
      joined({ assignmentId: "a2", departmentId: "d2", shiftId: "s1" }),
      joined({ assignmentId: "a3", departmentId: "d1", shiftId: "s2" }),
    ];

    expect(
      buildAttendanceList(input, filters({ departmentId: "d1" })).rows.map((row) => row.assignmentId),
    ).toEqual(["a1", "a3"]);
    expect(
      buildAttendanceList(input, filters({ shiftId: "s2" })).rows.map((row) => row.assignmentId),
    ).toEqual(["a3"]);
  });

  it("matches a name and an employee ID in any case", () => {
    const input = [
      joined({ assignmentId: "a1", workerName: "Budi Santoso", employeeId: "E-100" }),
      joined({ assignmentId: "a2", workerName: "Sari", employeeId: "X-200" }),
    ];

    expect(
      buildAttendanceList(input, filters({ query: "SANTO" })).rows.map((row) => row.assignmentId),
    ).toEqual(["a1"]);
    expect(
      buildAttendanceList(input, filters({ query: "x-2" })).rows.map((row) => row.assignmentId),
    ).toEqual(["a2"]);
  });

  it("counts every worker of the day in the summary, whatever the filters", () => {
    const input = [
      joined({ assignmentId: "a1", status: "present" }),
      joined({ assignmentId: "a2", status: "absent", departmentId: "d2" }),
      joined({ assignmentId: "a3" }),
    ];

    const { rows, summary } = buildAttendanceList(
      input,
      filters({ status: "present", departmentId: "d1", query: "budi" }),
    );

    expect(rows).toHaveLength(1);
    expect(summary).toEqual({
      scheduled: 3,
      present: 1,
      absent: 1,
      sick: 0,
      leave: 0,
      notMarked: 1,
    });
  });

  it("orders by department, then shift order, then worker name", () => {
    const { rows } = buildAttendanceList(
      [
        joined({ assignmentId: "a1", departmentName: "Produksi", shiftOrder: 2, workerName: "Agus" }),
        joined({ assignmentId: "a2", departmentName: "Gudang", shiftOrder: 3, workerName: "Zaki" }),
        joined({ assignmentId: "a3", departmentName: "Produksi", shiftOrder: 1, workerName: "Dewi" }),
        joined({ assignmentId: "a4", departmentName: "Produksi", shiftOrder: 1, workerName: "bayu" }),
      ],
      filters(),
    );

    expect(rows.map((row) => row.assignmentId)).toEqual(["a2", "a4", "a3", "a1"]);
  });

  it("lists a worker and a department that were deleted after the roster was made", () => {
    // The query does not filter deleted rows, so the shaping helper has nothing to hide either.
    const { rows } = buildAttendanceList(
      [joined({ workerName: "Former Worker", departmentName: "Closed Dept" })],
      filters(),
    );

    expect(rows).toHaveLength(1);
  });
});

describe("resolveSelection", () => {
  const sites = [{ id: "s1" }, { id: "s2" }];
  const locations = [
    { id: "l1", siteId: "s1" },
    { id: "l2", siteId: "s1" },
    { id: "l3", siteId: "s2" },
  ];

  it("keeps an allowed site and location", () => {
    expect(resolveSelection(sites, locations, "s1", "l2")).toEqual({ siteId: "s1", locationId: "l2" });
  });

  it("falls back to All for unknown values when there is a choice", () => {
    expect(resolveSelection(sites, locations, "nope", "nope")).toEqual({
      siteId: null,
      locationId: null,
    });
    expect(resolveSelection(sites, locations, null, null)).toEqual({ siteId: null, locationId: null });
  });

  it("picks the site's only location when the location belongs to another site", () => {
    expect(resolveSelection(sites, locations, "s2", "l1")).toEqual({ siteId: "s2", locationId: "l3" });
  });

  it("falls back to All locations when the site has several and the location is another site's", () => {
    expect(resolveSelection(sites, locations, "s1", "l3")).toEqual({ siteId: "s1", locationId: null });
  });

  it("gives nulls when nothing is allowed", () => {
    expect(resolveSelection([], [], "s1", "l1")).toEqual({ siteId: null, locationId: null });
    expect(resolveSelection(sites, [], "s1", "l1")).toEqual({ siteId: "s1", locationId: null });
  });
});
