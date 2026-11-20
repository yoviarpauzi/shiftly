import { describe, expect, it } from "vitest";
import type {
  RequestChoices,
  RequestDetail,
  RequestFormLine,
} from "@/types/requests";
import {
  MAX_REQUEST_LINES,
  blankLine,
  canAddLine,
  canRemoveLine,
  departmentsFor,
  formLineFromInput,
  isReadOnlyStatus,
  lineAfterDayChange,
  lineAfterDepartmentChange,
  lineAfterPerDayToggle,
  linesAfterLocationChange,
  locationsFor,
  positionsFor,
  requestFormDefaults,
  returnsToPending,
  shiftOptionLabel,
  shiftsFor,
  shiftsForRequest,
  subDepartmentsFor,
  toRequestLineInputs,
  minStartDateFor,
} from "./request-form-options";

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
const SHIFT_1 = "51000000-0000-4000-8000-000000000000";
const SHIFT_2 = "52000000-0000-4000-8000-000000000000";
const SHIFT_A2 = "5a000000-0000-4000-8000-000000000000";
const SHIFT_B1 = "5b000000-0000-4000-8000-000000000000";

const choices: RequestChoices = {
  locations: [
    { id: LOC_A1, name: "A1", timezone: "Asia/Jakarta" },
    { id: LOC_A2, name: "A2", timezone: "Asia/Jakarta" },
    { id: LOC_B1, name: "B1", timezone: "Asia/Makassar" },
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
    { id: POS_A, name: "Cook" },
    { id: POS_B, name: "Porter" },
  ],
  shifts: [
    { id: SHIFT_1, name: "Pagi", order: 1, startTime: "06:00", endTime: "14:00", locationId: LOC_A1 },
    { id: SHIFT_2, name: "Siang", order: 2, startTime: "14:00", endTime: "22:00", locationId: LOC_A1 },
    { id: SHIFT_A2, name: "Malam", order: 1, startTime: "22:00", endTime: "06:00", locationId: LOC_A2 },
    { id: SHIFT_B1, name: "Reguler", order: 1, startTime: "08:00", endTime: "16:00", locationId: LOC_B1 },
  ],
};

const detail: RequestDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  poNumber: "PO/ABC/2611/0001",
  type: "weekly",
  startDate: "2026-11-09",
  status: "approved",
  locationId: LOC_A1,
  locationName: "A1",
  lineCount: 1,
  createdByName: "Admin",
  rejectReason: null,
  lineShifts: [],
  lines: [
    {
      departmentId: DEPT_A1,
      subDepartmentId: SUB_A1,
      positionId: POS_A,
      shiftId: SHIFT_1,
      headcounts: [0, 3, 3, 0, 5, 5, 5],
    },
    {
      departmentId: DEPT_A1_2,
      subDepartmentId: null,
      positionId: POS_A,
      shiftId: null,
      headcounts: [4, 4, 4, 4, 4, 4, 4],
    },
  ],
};

const NAN_WEEK = Array.from({ length: 7 }, () => Number.NaN);

function formLine(fields: Partial<RequestFormLine> = {}): RequestFormLine {
  return {
    departmentId: DEPT_A1,
    subDepartmentId: SUB_A1,
    positionId: POS_A,
    shiftId: null,
    headcount: 2,
    perDay: false,
    dayHeadcounts: [...NAN_WEEK],
    ...fields,
  };
}

describe("locationsFor", () => {
  it("returns every location the choices hold, as options", () => {
    expect(locationsFor(choices)).toEqual([
      { id: LOC_A1, name: "A1" },
      { id: LOC_A2, name: "A2" },
      { id: LOC_B1, name: "B1" },
    ]);
  });

  it("returns nothing when the actor has no location", () => {
    expect(locationsFor({ ...choices, locations: [] })).toEqual([]);
  });
});

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
  it("returns every active position, whatever the location", () => {
    expect(positionsFor(choices).map((row) => row.id)).toEqual([POS_A, POS_B]);
  });

  it("offers id and name only", () => {
    expect(positionsFor(choices)[0]).toEqual({ id: POS_A, name: "Cook" });
  });
});

describe("shiftsFor", () => {
  it("lists the shifts of the location only, in order", () => {
    expect(shiftsFor(choices, LOC_A1).map((row) => row.id)).toEqual([SHIFT_1, SHIFT_2]);
    expect(shiftsFor(choices, LOC_A2).map((row) => row.id)).toEqual([SHIFT_A2]);
    expect(shiftsFor(choices, LOC_B1).map((row) => row.id)).toEqual([SHIFT_B1]);
  });

  it("is empty for an unknown location or none chosen", () => {
    expect(shiftsFor(choices, "unknown")).toEqual([]);
    expect(shiftsFor(choices, "")).toEqual([]);
  });
});

describe("shiftOptionLabel", () => {
  it("formats the order and the times", () => {
    expect(shiftOptionLabel({ order: 1, startTime: "06:00", endTime: "14:00" })).toBe(
      "Shift 1 · 06:00 - 14:00",
    );
  });
});

describe("line rules", () => {
  it("starts a blank line with empty choices and an empty headcount", () => {
    const line = blankLine();

    expect(line.departmentId).toBe("");
    expect(line.subDepartmentId).toBeNull();
    expect(line.positionId).toBe("");
    expect(Number.isNaN(line.headcount)).toBe(true);
    expect(line.perDay).toBe(false);
    expect(line.dayHeadcounts).toHaveLength(7);
    expect(line.dayHeadcounts.every(Number.isNaN)).toBe(true);
  });

  it("starts a blank line on Any shift", () => {
    expect(blankLine().shiftId).toBeNull();
  });

  it("replaces every line with one blank line when the location changes", () => {
    const lines = linesAfterLocationChange();

    expect(lines).toHaveLength(1);
    expect(lines[0].departmentId).toBe("");
  });

  it("clears the sub-department when the department changes", () => {
    const line = formLine({ perDay: true, dayHeadcounts: [1, 2, 3, 4, 5, 6, 7] });

    expect(lineAfterDepartmentChange(line, DEPT_A1_2)).toEqual({
      ...line,
      departmentId: DEPT_A1_2,
      subDepartmentId: null,
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

describe("shiftsForRequest", () => {
  const GONE = "5d000000-0000-4000-8000-000000000000";
  const gone = {
    id: GONE,
    name: "Lama",
    order: 3,
    startTime: "22:00",
    endTime: "06:00",
    locationId: LOC_A1,
  };

  it("is the location's shifts for a new request", () => {
    expect(shiftsForRequest(choices, LOC_A1, null).map((row) => row.id)).toEqual([
      SHIFT_1,
      SHIFT_2,
    ]);
  });

  it("adds a shift the request's lines use that is no longer offered, in order", () => {
    const request = { ...detail, lineShifts: [gone] };

    expect(shiftsForRequest(choices, LOC_A1, request).map((row) => row.id)).toEqual([
      SHIFT_1,
      SHIFT_2,
      GONE,
    ]);
  });

  it("does not repeat a shift that is already offered", () => {
    const request = { ...detail, lineShifts: [choices.shifts[0]] };

    expect(shiftsForRequest(choices, LOC_A1, request).map((row) => row.id)).toEqual([
      SHIFT_1,
      SHIFT_2,
    ]);
  });
});

describe("requestFormDefaults shifts", () => {
  it("keeps a line's shift that is deleted now but known from the request", () => {
    const GONE = "5d000000-0000-4000-8000-000000000000";
    const gone = {
      id: GONE,
      name: "Lama",
      order: 3,
      startTime: "22:00",
      endTime: "06:00",
      locationId: LOC_A1,
    };
    const rejected = {
      ...detail,
      status: "rejected" as const,
      lineShifts: [gone],
      lines: [{ ...detail.lines[0], shiftId: GONE }],
    };

    expect(requestFormDefaults(rejected, choices).lines[0].shiftId).toBe(GONE);
  });


  it("keeps a stored shift that is still one of the location's shifts", () => {
    expect(requestFormDefaults(detail, choices).lines.map((row) => row.shiftId)).toEqual([
      SHIFT_1,
      null,
    ]);
  });

  it("opens a line whose shift is no longer in the choices as Any shift", () => {
    const gone = {
      ...detail,
      lines: [{ ...detail.lines[0], shiftId: "5d000000-0000-4000-8000-000000000000" }],
    };

    expect(requestFormDefaults(gone, choices).lines[0].shiftId).toBeNull();
  });
});

describe("requestFormDefaults", () => {
  it("starts a new request blank with one line when several locations are available", () => {
    const values = requestFormDefaults(null, choices);

    expect(values.type).toBe("");
    expect(values.startDate).toBe("");
    expect(values.locationId).toBe("");
    expect(values).not.toHaveProperty("siteId");
    expect(values.lines).toHaveLength(1);
  });

  it("presets the location when the actor has only one", () => {
    const single = { ...choices, locations: [choices.locations[0]] };

    expect(requestFormDefaults(null, single).locationId).toBe(LOC_A1);
  });

  it("presets nothing when the actor has no location", () => {
    expect(requestFormDefaults(null, { ...choices, locations: [] }).locationId).toBe("");
  });

  it("loads an existing request with its location", () => {
    expect(requestFormDefaults(detail, choices)).toEqual({
      type: "weekly",
      startDate: "2026-11-09",
      locationId: LOC_A1,
      lines: detail.lines.map(formLineFromInput),
    });
  });
});

describe("formLineFromInput", () => {
  const ids = { departmentId: DEPT_A1, subDepartmentId: SUB_A1, positionId: POS_A, shiftId: null };

  it("keeps the stored shift", () => {
    const line = formLineFromInput({ ...ids, shiftId: SHIFT_1, headcounts: [7] });

    expect(line.shiftId).toBe(SHIFT_1);
  });

  it("opens a line with no shift as Any shift", () => {
    expect(formLineFromInput({ ...ids, headcounts: [7] }).shiftId).toBeNull();
  });

  it("opens a daily line as one number", () => {
    const line = formLineFromInput({ ...ids, headcounts: [7] });

    expect(line).toMatchObject({ ...ids, perDay: false, headcount: 7 });
    expect(line.dayHeadcounts).toHaveLength(7);
  });

  it("opens seven equal numbers as one number", () => {
    const line = formLineFromInput({ ...ids, headcounts: [4, 4, 4, 4, 4, 4, 4] });

    expect(line).toMatchObject({ perDay: false, headcount: 4 });
  });

  it("opens seven different numbers per day with the first number above 0 as the single", () => {
    const headcounts = [0, 3, 3, 0, 5, 5, 5];
    const line = formLineFromInput({ ...ids, headcounts });

    expect(line).toEqual({ ...ids, perDay: true, headcount: 3, dayHeadcounts: headcounts });
  });

  it("does not share the day array with the input", () => {
    const headcounts = [0, 3, 3, 0, 5, 5, 5];
    const line = formLineFromInput({ ...ids, headcounts });

    expect(line.dayHeadcounts).not.toBe(headcounts);
  });
});

describe("lineAfterPerDayToggle", () => {
  it("fills all seven days with the single number when turned on", () => {
    expect(lineAfterPerDayToggle(formLine({ headcount: 6 }), true)).toEqual(
      formLine({ headcount: 6, perDay: true, dayHeadcounts: [6, 6, 6, 6, 6, 6, 6] }),
    );
  });

  it("keeps the day numbers but turns per day off", () => {
    const line = formLine({ perDay: true, dayHeadcounts: [1, 2, 3, 4, 5, 6, 7] });

    expect(lineAfterPerDayToggle(line, false)).toEqual({ ...line, perDay: false });
  });

  it("fills seven empty days from an empty single number", () => {
    const next = lineAfterPerDayToggle(formLine({ headcount: Number.NaN }), true);

    expect(next.perDay).toBe(true);
    expect(next.dayHeadcounts).toHaveLength(7);
    expect(next.dayHeadcounts.every(Number.isNaN)).toBe(true);
  });
});

describe("lineAfterDayChange", () => {
  it("changes only the given day", () => {
    const line = formLine({ perDay: true, dayHeadcounts: [1, 1, 1, 1, 1, 1, 1] });

    expect(lineAfterDayChange(line, 2, 9)).toEqual({
      ...line,
      dayHeadcounts: [1, 1, 9, 1, 1, 1, 1],
    });
    expect(line.dayHeadcounts).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });
});

describe("toRequestLineInputs", () => {
  const ids = { departmentId: DEPT_A1, subDepartmentId: SUB_A1, positionId: POS_A, shiftId: null };
  const perDay = formLine({ headcount: 5, perDay: true, dayHeadcounts: [0, 1, 2, 3, 4, 5, 6] });

  it("sends one number for a daily line, even when per day was set", () => {
    expect(toRequestLineInputs("daily", [formLine({ headcount: 5 }), perDay])).toEqual([
      { ...ids, headcounts: [5] },
      { ...ids, headcounts: [5] },
    ]);
  });

  it("sends each line's shift", () => {
    expect(
      toRequestLineInputs("daily", [
        formLine({ headcount: 5, shiftId: SHIFT_1 }),
        formLine({ headcount: 5, shiftId: null }),
      ]).map((line) => line.shiftId),
    ).toEqual([SHIFT_1, null]);
  });

  it("repeats the single number seven times for a weekly line", () => {
    expect(toRequestLineInputs("weekly", [formLine({ headcount: 5 })])).toEqual([
      { ...ids, headcounts: [5, 5, 5, 5, 5, 5, 5] },
    ]);
  });

  it("sends the seven day numbers for a weekly line set per day", () => {
    expect(toRequestLineInputs("weekly", [perDay])).toEqual([
      { ...ids, headcounts: [0, 1, 2, 3, 4, 5, 6] },
    ]);
  });

  it("treats an unchosen type like daily", () => {
    expect(toRequestLineInputs("", [perDay])).toEqual([{ ...ids, headcounts: [5] }]);
  });

  it("keeps an empty number as NaN", () => {
    const [input] = toRequestLineInputs("daily", [formLine({ headcount: Number.NaN })]);

    expect(Number.isNaN(input.headcounts[0])).toBe(true);
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

describe("minStartDateFor", () => {
  // 2026-11-30 23:30 in Jakarta, already 2026-12-01 00:30 in Makassar.
  const now = new Date("2026-11-30T16:30:00Z");

  it("uses the chosen location's zone", () => {
    expect(minStartDateFor(choices, LOC_A1, now)).toBe("2026-11-30");
    expect(minStartDateFor(choices, LOC_B1, now)).toBe("2026-12-01");
  });

  it("falls back to Jakarta before a location is chosen", () => {
    expect(minStartDateFor(choices, "", now)).toBe("2026-11-30");
  });

  it("falls back to Jakarta for a location that is not in the choices", () => {
    expect(minStartDateFor(choices, "ffffffff-0000-4000-8000-000000000000", now)).toBe(
      "2026-11-30",
    );
  });
});
