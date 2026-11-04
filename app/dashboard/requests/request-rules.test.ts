import { describe, expect, it } from "vitest";
import {
  UNKNOWN_SHIFT_MESSAGE,
  DAILY_HEADCOUNT_MESSAGE,
  HEADCOUNT_LENGTH_MESSAGE,
  WEEKLY_HEADCOUNT_MESSAGE,
  canCancelRequest,
  canDecideStatus,
  dayLabels,
  formatRequestDates,
  headcountsError,
  initialStatus,
  lineScopeError,
  linesHeadcountsError,
  requestFieldErrors,
  requestLocationsFor,
  siteCodeMissingMessage,
  statusAfterEdit,
} from "./request-rules";
import type { RequestStatus } from "@/types/requests";

const DEPT_A = "dept-a";
const DEPT_B = "dept-b";
const SUB_A = "sub-a";
const SUB_B = "sub-b";
const POSITION = "position-1";
const SHIFT = "shift-1";

const valid = {
  departments: new Map([
    [DEPT_A, new Set([SUB_A])],
    [DEPT_B, new Set([SUB_B])],
  ]),
  positionIds: new Set([POSITION]),
  shiftIds: new Set([SHIFT]),
};

const line = (fields: {
  departmentId?: string;
  subDepartmentId?: string | null;
  positionId?: string;
  shiftId?: string | null;
}) => ({
  departmentId: DEPT_A,
  subDepartmentId: null,
  positionId: POSITION,
  shiftId: null,
  headcounts: [2],
  ...fields,
});

describe("lineScopeError shifts", () => {
  it("returns the unknown shift message for a shift outside the location", () => {
    expect(lineScopeError([line({ shiftId: "other-site-shift" })], valid)).toBe(
      UNKNOWN_SHIFT_MESSAGE,
    );
    expect(UNKNOWN_SHIFT_MESSAGE).toBe("Choose a shift of this location");
  });

  it("accepts a null shift", () => {
    expect(lineScopeError([line({ shiftId: null })], valid)).toBeNull();
  });

  it("accepts a shift of the location", () => {
    expect(lineScopeError([line({ shiftId: SHIFT })], valid)).toBeNull();
  });
});

describe("initialStatus", () => {
  it("approves a daily request on save", () => {
    expect(initialStatus("daily")).toBe("approved");
  });

  it("holds a weekly request for approval", () => {
    expect(initialStatus("weekly")).toBe("pending");
  });
});

describe("statusAfterEdit", () => {
  it("sends an approved weekly request back to pending", () => {
    expect(statusAfterEdit("weekly", "approved")).toBe("pending");
  });

  it("keeps an approved daily request approved", () => {
    expect(statusAfterEdit("daily", "approved")).toBe("approved");
  });

  it("keeps a pending request pending", () => {
    expect(statusAfterEdit("weekly", "pending")).toBe("pending");
    expect(statusAfterEdit("daily", "pending")).toBe("pending");
  });

  it("does not allow editing a rejected or cancelled request", () => {
    expect(statusAfterEdit("weekly", "rejected")).toBeNull();
    expect(statusAfterEdit("daily", "rejected")).toBeNull();
    expect(statusAfterEdit("weekly", "cancelled")).toBeNull();
    expect(statusAfterEdit("daily", "cancelled")).toBeNull();
  });
});

describe("canCancelRequest", () => {
  it.each<[RequestStatus, boolean]>([
    ["pending", true],
    ["approved", true],
    ["rejected", false],
    ["cancelled", false],
  ])("%s gives %s", (status, expected) => {
    expect(canCancelRequest(status)).toBe(expected);
  });
});

describe("canDecideStatus", () => {
  it.each<[RequestStatus, boolean]>([
    ["pending", true],
    ["approved", false],
    ["rejected", false],
    ["cancelled", false],
  ])("%s gives %s", (status, expected) => {
    expect(canDecideStatus(status)).toBe(expected);
  });
});

describe("formatRequestDates", () => {
  it("shows one date for a daily request", () => {
    expect(formatRequestDates("daily", "2026-11-03")).toBe("2026-11-03");
  });

  it("shows a 7 day range for a weekly request", () => {
    expect(formatRequestDates("weekly", "2026-11-03")).toBe("2026-11-03 - 2026-11-09");
  });

  it("crosses a month end", () => {
    expect(formatRequestDates("weekly", "2026-11-27")).toBe("2026-11-27 - 2026-12-03");
  });

  it("crosses a year end", () => {
    expect(formatRequestDates("weekly", "2026-12-29")).toBe("2026-12-29 - 2027-01-04");
  });

  it("handles a leap day", () => {
    expect(formatRequestDates("weekly", "2028-02-26")).toBe("2028-02-26 - 2028-03-03");
  });
});

describe("lineScopeError", () => {
  it("returns null for a valid set", () => {
    expect(
      lineScopeError(
        [line({}), line({ departmentId: DEPT_B, subDepartmentId: SUB_B })],
        valid,
      ),
    ).toBeNull();
  });

  it("rejects an unknown department", () => {
    expect(lineScopeError([line({ departmentId: "missing" })], valid)).toEqual(
      expect.any(String),
    );
  });

  it("rejects a sub-department of another department", () => {
    expect(lineScopeError([line({ subDepartmentId: SUB_B })], valid)).toEqual(
      expect.any(String),
    );
  });

  it("rejects an unknown position", () => {
    expect(lineScopeError([line({ positionId: "missing" })], valid)).toEqual(
      expect.any(String),
    );
  });

  it("uses a different message for each failure", () => {
    const messages = [
      lineScopeError([line({ departmentId: "missing" })], valid),
      lineScopeError([line({ subDepartmentId: SUB_B })], valid),
      lineScopeError([line({ positionId: "missing" })], valid),
    ];

    expect(new Set(messages).size).toBe(3);
  });
});

describe("requestFieldErrors", () => {
  it("keeps the first message for each field", () => {
    expect(
      requestFieldErrors([
        { path: ["startDate"], message: "first" },
        { path: ["startDate"], message: "second" },
        { path: ["lines", 0, "headcounts", 0], message: "lines message" },
      ]),
    ).toEqual({ startDate: "first", lines: "lines message" });
  });
});

describe("siteCodeMissingMessage", () => {
  it("names the site and asks for a code", () => {
    const message = siteCodeMissingMessage("Nestle Kejayan");

    expect(message).toContain("Nestle Kejayan");
    expect(message).toContain("Add a code to the site before creating requests");
  });
});

describe("requestLocationsFor", () => {
  const LOCATIONS = [
    { id: "loc-1", name: "Gate 1", siteId: "site-a" },
    { id: "loc-2", name: "Gate 2", siteId: "site-a" },
    { id: "loc-3", name: "Pier", siteId: "site-b" },
  ];

  it("offers no locations to a site picker until a site is chosen", () => {
    expect(requestLocationsFor(LOCATIONS, null, true)).toEqual([]);
  });

  it("offers only the locations of the chosen site", () => {
    expect(requestLocationsFor(LOCATIONS, "site-a", true)).toEqual([
      LOCATIONS[0],
      LOCATIONS[1],
    ]);
    expect(requestLocationsFor(LOCATIONS, "site-b", true)).toEqual([LOCATIONS[2]]);
  });

  it("offers every location when the actor has no site to pick", () => {
    expect(requestLocationsFor(LOCATIONS, null, false)).toEqual(LOCATIONS);
  });
});

describe("headcountsError", () => {
  it("has the exact messages", () => {
    expect(DAILY_HEADCOUNT_MESSAGE).toBe("Headcount must be between 1 and 999");
    expect(WEEKLY_HEADCOUNT_MESSAGE).toBe(
      "Each line needs at least one day with a headcount above 0",
    );
    expect(HEADCOUNT_LENGTH_MESSAGE).toBe("Headcount does not match the request type");
  });

  it("accepts a daily headcount from 1 to 999", () => {
    expect(headcountsError("daily", [1])).toBeNull();
    expect(headcountsError("daily", [999])).toBeNull();
  });

  it("rejects a daily headcount of 0", () => {
    expect(headcountsError("daily", [0])).toBe(DAILY_HEADCOUNT_MESSAGE);
  });

  it("rejects a daily line that does not have exactly one number", () => {
    expect(headcountsError("daily", [2, 2])).toBe(HEADCOUNT_LENGTH_MESSAGE);
    expect(headcountsError("daily", [])).toBe(HEADCOUNT_LENGTH_MESSAGE);
  });

  it("accepts a weekly line with at least one day above 0", () => {
    expect(headcountsError("weekly", [0, 0, 5, 0, 0, 0, 0])).toBeNull();
    expect(headcountsError("weekly", [1, 1, 1, 1, 1, 1, 1])).toBeNull();
  });

  it("rejects a weekly line where every day is 0", () => {
    expect(headcountsError("weekly", [0, 0, 0, 0, 0, 0, 0])).toBe(WEEKLY_HEADCOUNT_MESSAGE);
  });

  it("rejects a weekly line that does not have exactly seven numbers", () => {
    expect(headcountsError("weekly", [3])).toBe(HEADCOUNT_LENGTH_MESSAGE);
    expect(headcountsError("weekly", [1, 1, 1, 1, 1, 1])).toBe(HEADCOUNT_LENGTH_MESSAGE);
  });
});

describe("linesHeadcountsError", () => {
  it("returns null for no lines", () => {
    expect(linesHeadcountsError("weekly", [])).toBeNull();
  });

  it("returns null when every line is valid", () => {
    expect(
      linesHeadcountsError("weekly", [
        { headcounts: [1, 0, 0, 0, 0, 0, 0] },
        { headcounts: [2, 2, 2, 2, 2, 2, 2] },
      ]),
    ).toBeNull();
    expect(linesHeadcountsError("daily", [{ headcounts: [4] }, { headcounts: [1] }])).toBeNull();
  });

  it("returns the message of the first failing line", () => {
    expect(
      linesHeadcountsError("weekly", [
        { headcounts: [1, 1, 1, 1, 1, 1, 1] },
        { headcounts: [0, 0, 0, 0, 0, 0, 0] },
        { headcounts: [1] },
      ]),
    ).toBe(WEEKLY_HEADCOUNT_MESSAGE);
  });
});

describe("dayLabels", () => {
  const FALLBACK = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];

  it("labels the seven days from the start date", () => {
    expect(dayLabels("2026-11-02")).toEqual([
      "Mon 2 Nov",
      "Tue 3 Nov",
      "Wed 4 Nov",
      "Thu 5 Nov",
      "Fri 6 Nov",
      "Sat 7 Nov",
      "Sun 8 Nov",
    ]);
  });

  it("crosses a month end", () => {
    expect(dayLabels("2026-11-29")).toEqual([
      "Sun 29 Nov",
      "Mon 30 Nov",
      "Tue 1 Dec",
      "Wed 2 Dec",
      "Thu 3 Dec",
      "Fri 4 Dec",
      "Sat 5 Dec",
    ]);
  });

  it("crosses a leap day", () => {
    expect(dayLabels("2028-02-27")).toEqual([
      "Sun 27 Feb",
      "Mon 28 Feb",
      "Tue 29 Feb",
      "Wed 1 Mar",
      "Thu 2 Mar",
      "Fri 3 Mar",
      "Sat 4 Mar",
    ]);
  });

  it("falls back to numbered days for an empty, malformed or impossible date", () => {
    expect(dayLabels("")).toEqual(FALLBACK);
    expect(dayLabels("2026-02-30")).toEqual(FALLBACK);
    expect(dayLabels("11/02/2026")).toEqual(FALLBACK);
  });
});
