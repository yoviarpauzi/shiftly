import { describe, expect, it } from "vitest";
import type {
  RequestChoices,
  RequestDetail,
  RequestFieldErrors,
  RequestFormLine,
} from "@/types/requests";
import {
  MAX_REQUEST_LINES,
  SITE_REQUIRED_MESSAGE,
  afterSiteChange,
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
  subDepartmentsFor,
  toRequestLineInputs,
  withSiteError,
  minStartDateFor,
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
const SHIFT_1 = "51000000-0000-4000-8000-000000000000";

const choices: RequestChoices = {
  sites: [
    { id: SITE_A, name: "Site A" },
    { id: SITE_B, name: "Site B" },
  ],
  locations: [
    { id: LOC_A1, name: "A1", siteId: SITE_A, timezone: "Asia/Jakarta" },
    { id: LOC_A2, name: "A2", siteId: SITE_A, timezone: "Asia/Jakarta" },
    { id: LOC_B1, name: "B1", siteId: SITE_B, timezone: "Asia/Makassar" },
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
  siteName: "Site A",
  locationId: LOC_A1,
  locationName: "A1",
  lineCount: 1,
  createdByName: "Admin",
  rejectReason: null,
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
  it("returns only the locations of the site", () => {
    expect(locationsFor(choices, SITE_A).map((row) => row.id)).toEqual([LOC_A1, LOC_A2]);
    expect(locationsFor(choices, SITE_B).map((row) => row.id)).toEqual([LOC_B1]);
  });

  it("returns nothing when no site is chosen or the site is unknown", () => {
    expect(locationsFor(choices, "")).toEqual([]);
    expect(locationsFor(choices, "unknown")).toEqual([]);
  });
});

describe("afterSiteChange", () => {
  it("clears the location and starts the lines over for a site with several locations", () => {
    const next = afterSiteChange(choices, SITE_A);

    expect(next.locationId).toBe("");
    expect(next.lines).toHaveLength(1);
    expect(next.lines[0].departmentId).toBe("");
  });

  it("presets the location when the new site has only one", () => {
    const next = afterSiteChange(choices, SITE_B);

    expect(next.locationId).toBe(LOC_B1);
    expect(next.lines).toHaveLength(1);
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

describe("requestFormDefaults", () => {
  it("starts a new request blank with one line when several sites are available", () => {
    const values = requestFormDefaults(null, choices);

    expect(values.type).toBe("");
    expect(values.startDate).toBe("");
    expect(values.siteId).toBe("");
    expect(values.locationId).toBe("");
    expect(values.lines).toHaveLength(1);
  });

  it("presets the site and the location when the actor has only one of each", () => {
    const single = {
      ...choices,
      sites: [choices.sites[0]],
      locations: [choices.locations[0]],
    };
    const values = requestFormDefaults(null, single);

    expect(values.siteId).toBe(SITE_A);
    expect(values.locationId).toBe(LOC_A1);
  });

  it("presets only the site when its site has several locations", () => {
    const oneSite = {
      ...choices,
      sites: [choices.sites[0]],
      locations: [choices.locations[0], choices.locations[1]],
    };
    const values = requestFormDefaults(null, oneSite);

    expect(values.siteId).toBe(SITE_A);
    expect(values.locationId).toBe("");
  });

  it("does not preset a location while the site is still to be chosen", () => {
    const perSite = {
      ...choices,
      locations: [choices.locations[0], choices.locations[2]],
    };

    expect(requestFormDefaults(null, perSite).locationId).toBe("");
  });

  it("loads an existing request with its site", () => {
    expect(requestFormDefaults(detail, choices)).toEqual({
      type: "weekly",
      startDate: "2026-11-09",
      siteId: SITE_A,
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

describe("withSiteError", () => {
  const errors: RequestFieldErrors = {
    locationId: "Choose a location",
    lines: "Add at least one line",
  };

  it("moves the location error onto the site when the site picker shows and no site is chosen", () => {
    const next = withSiteError(errors, "", true);

    expect(SITE_REQUIRED_MESSAGE).toBe("Choose a site");
    expect(next).toEqual({ siteId: "Choose a site", lines: "Add at least one line" });
    expect("locationId" in next).toBe(false);
  });

  it("keeps a location error on the location once a site is chosen", () => {
    expect(withSiteError(errors, SITE_A, true)).toEqual(errors);
  });

  it("leaves the errors alone when the site is fixed text, which cannot show an error", () => {
    expect(withSiteError(errors, "", false)).toEqual(errors);
  });

  it("adds nothing when there is no location error", () => {
    const other: RequestFieldErrors = { type: "Choose a type" };

    expect(withSiteError(other, "", true)).toEqual(other);
    expect(withSiteError({}, "", true)).toEqual({});
  });

  it("does not change the errors it is given", () => {
    const input: RequestFieldErrors = { ...errors };

    withSiteError(input, "", true);

    expect(input).toEqual(errors);
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
