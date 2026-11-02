import { describe, expect, it } from "vitest";
import type { RequestChoices, RequestDetail } from "@/types/requests";
import {
  MAX_REQUEST_LINES,
  blankLine,
  canAddLine,
  canRemoveLine,
  departmentsFor,
  isReadOnlyStatus,
  lineAfterDepartmentChange,
  linesAfterLocationChange,
  positionsFor,
  requestFormDefaults,
  returnsToPending,
  subDepartmentsFor,
} from "./request-form-options";

const SITE_A = "a0000000-0000-4000-8000-000000000000";
const SITE_B = "b0000000-0000-4000-8000-000000000000";
const LOC_A1 = "a1000000-0000-4000-8000-000000000000";
const LOC_A2 = "a2000000-0000-4000-8000-000000000000";
const LOC_B1 = "b1000000-0000-4000-8000-000000000000";
const DEPT_A1 = "da100000-0000-4000-8000-000000000000";
const DEPT_A1_2 = "da120000-0000-4000-8000-000000000000";
const DEPT_B1 = "db100000-0000-4000-8000-000000000000";
const SUB_A1 = "5a100000-0000-4000-8000-000000000000";
const SUB_B1 = "5b100000-0000-4000-8000-000000000000";
const POS_A = "9a000000-0000-4000-8000-000000000000";
const POS_B = "9b000000-0000-4000-8000-000000000000";

const choices: RequestChoices = {
  locations: [
    { id: LOC_A1, name: "A1", siteId: SITE_A },
    { id: LOC_A2, name: "A2", siteId: SITE_A },
    { id: LOC_B1, name: "B1", siteId: SITE_B },
  ],
  departments: [
    { id: DEPT_A1, name: "Kitchen", locationId: LOC_A1 },
    { id: DEPT_A1_2, name: "Laundry", locationId: LOC_A1 },
    { id: DEPT_B1, name: "Lobby", locationId: LOC_B1 },
  ],
  subDepartments: [
    { id: SUB_A1, name: "Pastry", departmentId: DEPT_A1 },
    { id: SUB_B1, name: "Front", departmentId: DEPT_B1 },
  ],
  positions: [
    { id: POS_A, name: "Cook", siteId: SITE_A },
    { id: POS_B, name: "Porter", siteId: SITE_B },
  ],
};

const detail: RequestDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  poNumber: "PO/ABC/2611/0001",
  type: "weekly",
  startDate: "2026-11-09",
  status: "approved",
  siteId: SITE_A,
  locationId: LOC_A1,
  locationName: "A1",
  lineCount: 1,
  createdByName: "Admin",
  rejectReason: null,
  lines: [
    { departmentId: DEPT_A1, subDepartmentId: SUB_A1, positionId: POS_A, headcount: 3 },
  ],
};

describe("departmentsFor", () => {
  it("returns only the departments of the location", () => {
    expect(departmentsFor(choices, LOC_A1).map((row) => row.id)).toEqual([DEPT_A1, DEPT_A1_2]);
  });

  it("returns nothing when no location is chosen", () => {
    expect(departmentsFor(choices, "")).toEqual([]);
  });
});

describe("subDepartmentsFor", () => {
  it("returns only the sub-departments of the department", () => {
    expect(subDepartmentsFor(choices, DEPT_A1).map((row) => row.id)).toEqual([SUB_A1]);
  });

  it("returns nothing for a department without sub-departments", () => {
    expect(subDepartmentsFor(choices, DEPT_A1_2)).toEqual([]);
  });

  it("returns nothing when no department is chosen", () => {
    expect(subDepartmentsFor(choices, "")).toEqual([]);
  });
});

describe("positionsFor", () => {
  it("returns the positions of the location's site", () => {
    expect(positionsFor(choices, LOC_A2).map((row) => row.id)).toEqual([POS_A]);
    expect(positionsFor(choices, LOC_B1).map((row) => row.id)).toEqual([POS_B]);
  });

  it("returns nothing for an unknown or empty location", () => {
    expect(positionsFor(choices, "")).toEqual([]);
    expect(positionsFor(choices, "unknown")).toEqual([]);
  });
});

describe("line rules", () => {
  it("starts a blank line with empty choices and an empty headcount", () => {
    const line = blankLine();

    expect(line.departmentId).toBe("");
    expect(line.subDepartmentId).toBeNull();
    expect(line.positionId).toBe("");
    expect(Number.isNaN(line.headcount)).toBe(true);
  });

  it("replaces every line with one blank line when the location changes", () => {
    const lines = linesAfterLocationChange();

    expect(lines).toHaveLength(1);
    expect(lines[0].departmentId).toBe("");
  });

  it("clears the sub-department when the department changes", () => {
    const line = { departmentId: DEPT_A1, subDepartmentId: SUB_A1, positionId: POS_A, headcount: 2 };

    expect(lineAfterDepartmentChange(line, DEPT_A1_2)).toEqual({
      departmentId: DEPT_A1_2,
      subDepartmentId: null,
      positionId: POS_A,
      headcount: 2,
    });
  });

  it("allows adding lines up to 50", () => {
    expect(MAX_REQUEST_LINES).toBe(50);
    expect(canAddLine(49)).toBe(true);
    expect(canAddLine(50)).toBe(false);
  });

  it("keeps at least one line", () => {
    expect(canRemoveLine(1)).toBe(false);
    expect(canRemoveLine(2)).toBe(true);
  });
});

describe("requestFormDefaults", () => {
  it("starts a new request blank with one line", () => {
    const values = requestFormDefaults(null, choices);

    expect(values.type).toBe("");
    expect(values.startDate).toBe("");
    expect(values.locationId).toBe("");
    expect(values.lines).toHaveLength(1);
  });

  it("presets the location when the actor has only one", () => {
    const single = { ...choices, locations: [choices.locations[0]] };

    expect(requestFormDefaults(null, single).locationId).toBe(LOC_A1);
  });

  it("loads an existing request", () => {
    expect(requestFormDefaults(detail, choices)).toEqual({
      type: "weekly",
      startDate: "2026-11-09",
      locationId: LOC_A1,
      lines: detail.lines,
    });
  });
});

describe("status helpers", () => {
  it("says an approved weekly request returns to pending on edit", () => {
    expect(returnsToPending(detail)).toBe(true);
  });

  it("says nothing returns to pending for a daily or pending request", () => {
    expect(returnsToPending({ ...detail, type: "daily" })).toBe(false);
    expect(returnsToPending({ ...detail, status: "pending" })).toBe(false);
  });

  it("opens rejected and cancelled requests read-only", () => {
    expect(isReadOnlyStatus("rejected")).toBe(true);
    expect(isReadOnlyStatus("cancelled")).toBe(true);
    expect(isReadOnlyStatus("pending")).toBe(false);
    expect(isReadOnlyStatus("approved")).toBe(false);
  });
});
