import { describe, expect, it } from "vitest";

import {
  addDays,
  evenSplit,
  monthKey,
  monthName,
  requestDays,
  rulesForLocation,
  shortDate,
  targetsTotalError,
} from "./roster-rules";

describe("addDays", () => {
  it("adds one day across a month and a year boundary", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("knows leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("subtracts days", () => {
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
  });

  it("returns the same day for zero", () => {
    expect(addDays("2026-11-09", 0)).toBe("2026-11-09");
  });
});

describe("requestDays", () => {
  it("gives one date for a daily request", () => {
    expect(requestDays("2026-11-09", "daily")).toEqual(["2026-11-09"]);
  });

  it("gives seven dates for a weekly request, across a month boundary", () => {
    expect(requestDays("2026-11-09", "weekly")).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
    expect(requestDays("2026-11-28", "weekly").at(-1)).toBe("2026-12-04");
  });
});

describe("date labels", () => {
  it("builds the month key", () => {
    expect(monthKey("2026-11-09")).toBe("2026-11");
  });

  it("builds the short date with the weekday", () => {
    expect(shortDate("2026-11-10")).toBe("Tue 10 Nov");
    expect(shortDate("2026-11-09")).toBe("Mon 9 Nov");
    expect(shortDate("2026-12-31")).toBe("Thu 31 Dec");
  });

  it("builds the month name", () => {
    expect(monthName("2026-11-10")).toBe("November");
    expect(monthName("2027-01-01")).toBe("January");
  });
});

describe("evenSplit", () => {
  it("splits evenly when the total divides", () => {
    expect(evenSplit(6, ["a", "b", "c"])).toEqual([2, 2, 2]);
  });

  it("gives the remainder to the earliest shifts", () => {
    expect(evenSplit(7, ["a", "b", "c"])).toEqual([3, 2, 2]);
    expect(evenSplit(2, ["a", "b", "c"])).toEqual([1, 1, 0]);
  });

  it("gives zeros for a total of zero", () => {
    expect(evenSplit(0, ["a", "b", "c"])).toEqual([0, 0, 0]);
  });

  it("always adds up to the total", () => {
    for (const total of [0, 1, 5, 11, 100]) {
      const split = evenSplit(total, ["a", "b", "c", "d"]);

      expect(split.reduce((sum, n) => sum + n, 0)).toBe(total);
    }
  });
});

describe("targetsTotalError", () => {
  it("returns the first day that does not add up", () => {
    expect(
      targetsTotalError(
        [6, 6],
        [
          [2, 2, 2],
          [3, 2, 2],
        ],
      ),
    ).toEqual({ dayIndex: 1, sum: 7, required: 6 });
  });

  it("returns null when every day adds up", () => {
    expect(
      targetsTotalError(
        [6, 0],
        [
          [2, 2, 2],
          [0, 0, 0],
        ],
      ),
    ).toBeNull();
  });
});

describe("rulesForLocation", () => {
  it("gives the built-in defaults", () => {
    expect(rulesForLocation("any")).toEqual({
      workDaysPerWeek: 5,
      shiftExceptionDays: 7,
      requirePositionMatch: true,
      maxWorkingDaysPerMonth: 26,
    });
  });
});
