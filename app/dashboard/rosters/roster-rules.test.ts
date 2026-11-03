import { describe, expect, it } from "vitest";

import {
  addDays,
  CELL_BUSY_MESSAGE,
  CELL_DATE_MESSAGE,
  CELL_OTHER_LINE_MESSAGE,
  CELL_SHIFT_MESSAGE,
  CELL_WORKS_THAT_DAY_MESSAGE,
  confirmDescription,
  dayLabel,
  evenSplit,
  generateAgainDescription,
  isRosterEditable,
  formatRosterTime,
  monthKey,
  monthName,
  requestDays,
  rulesForLocation,
  shortDate,
  isUniqueViolation,
  splitsToTargets,
  targetsTotalError,
  targetsTotalMessage,
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

describe("splitsToTargets", () => {
  it("gives a target for every cell, zero headcounts included, in line, day, shift order", () => {
    expect(
      splitsToTargets(
        ["l1", "l2"],
        ["2026-11-09", "2026-11-10"],
        ["s1", "s2"],
        [
          [
            [2, 1],
            [0, 3],
          ],
          [
            [1, 0],
            [1, 1],
          ],
        ],
      ),
    ).toEqual([
      { lineId: "l1", date: "2026-11-09", shiftId: "s1", headcount: 2 },
      { lineId: "l1", date: "2026-11-09", shiftId: "s2", headcount: 1 },
      { lineId: "l1", date: "2026-11-10", shiftId: "s1", headcount: 0 },
      { lineId: "l1", date: "2026-11-10", shiftId: "s2", headcount: 3 },
      { lineId: "l2", date: "2026-11-09", shiftId: "s1", headcount: 1 },
      { lineId: "l2", date: "2026-11-09", shiftId: "s2", headcount: 0 },
      { lineId: "l2", date: "2026-11-10", shiftId: "s1", headcount: 1 },
      { lineId: "l2", date: "2026-11-10", shiftId: "s2", headcount: 1 },
    ]);
  });

  it("gives nothing when there are no shifts", () => {
    expect(splitsToTargets(["l1"], ["2026-11-09"], [], [[[]]])).toEqual([]);
  });
});

describe("formatRosterTime", () => {
  it("shows the day, month, and time in Jakarta whatever the server zone is", () => {
    expect(formatRosterTime("2026-11-03T14:17:54.584Z")).toBe("3 Nov 21:17");
  });

  it("rolls over to the next day in Jakarta", () => {
    expect(formatRosterTime("2026-11-30T20:05:00.000Z")).toBe("1 Dec 03:05");
  });
});

describe("targetsTotalMessage", () => {
  it("names the day, the sum, and what the request needs", () => {
    expect(targetsTotalMessage("2026-11-10", 4, 5)).toBe(
      "Tue 10 Nov adds up to 4, but the request needs 5. Make each day add up to the request.",
    );
  });
});

describe("isUniqueViolation", () => {
  it("recognises a Postgres unique violation", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("recognises one that Drizzle wraps as the cause", () => {
    expect(isUniqueViolation(new Error("failed", { cause: { code: "23505" } }))).toBe(true);
  });

  it("does not take another error for one", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});

describe("isRosterEditable", () => {
  it("is true only for a draft whose request is still approved", () => {
    expect(isRosterEditable("draft", "approved")).toBe(true);
    expect(isRosterEditable("confirmed", "approved")).toBe(false);
    expect(isRosterEditable("draft", "cancelled")).toBe(false);
    expect(isRosterEditable("draft", "pending")).toBe(false);
    expect(isRosterEditable("confirmed", "cancelled")).toBe(false);
  });
});

describe("dayLabel", () => {
  it("gives the weekday and the day of the month", () => {
    expect(dayLabel("2026-11-09")).toBe("Mon 9");
    expect(dayLabel("2026-11-15")).toBe("Sun 15");
  });
});

describe("confirmDescription", () => {
  const LOCKED =
    "A confirmed roster is locked: you can no longer replace workers or generate it again.";

  it("only warns about the lock when nothing is unfilled", () => {
    expect(confirmDescription(0)).toBe(LOCKED);
  });

  it("counts one unfilled shift in the singular", () => {
    expect(confirmDescription(1)).toBe(`1 shift is still unfilled. ${LOCKED}`);
  });

  it("counts several unfilled shifts in the plural", () => {
    expect(confirmDescription(3)).toBe(`3 shifts are still unfilled. ${LOCKED}`);
  });
});

describe("generateAgainDescription", () => {
  it("says only that the draft is replaced when there is nothing to lose", () => {
    expect(generateAgainDescription(0, 0)).toBe("The current draft is replaced.");
  });

  it("names the manual replacements and the conflicts it discards", () => {
    expect(generateAgainDescription(1, 2)).toBe(
      "The current draft is replaced. This discards 1 manual replacement and the 2 conflicts listed now.",
    );
    expect(generateAgainDescription(3, 1)).toBe(
      "The current draft is replaced. This discards 3 manual replacements and the 1 conflict listed now.",
    );
  });

  it("names only what exists", () => {
    expect(generateAgainDescription(2, 0)).toBe(
      "The current draft is replaced. This discards 2 manual replacements.",
    );
    expect(generateAgainDescription(0, 4)).toBe(
      "The current draft is replaced. This discards the 4 conflicts listed now.",
    );
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

describe("cell edit messages", () => {
  it("states each refusal", () => {
    expect(CELL_DATE_MESSAGE).toBe("That day is not in this roster.");
    expect(CELL_SHIFT_MESSAGE).toBe("That shift is not available at this site.");
    expect(CELL_OTHER_LINE_MESSAGE).toBe(
      "This worker already has a row on that day in another line.",
    );
    expect(CELL_BUSY_MESSAGE).toBe("This worker already works on that day in another roster.");
    expect(CELL_WORKS_THAT_DAY_MESSAGE).toBe("This worker already works on that day.");
  });
});
