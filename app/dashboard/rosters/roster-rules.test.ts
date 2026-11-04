import { describe, expect, it } from "vitest";

import type {
  RosterCell,
  RosterLineFilters,
  RosterLineView,
  RosterWorkerRow,
} from "@/types/rosters";

import { WORK_RULE_DEFAULTS } from "@/app/dashboard/settings/settings-rules";

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
  fixedSplit,
  generateAgainDescription,
  filterLines,
  isRosterEditable,
  formatRosterTime,
  lineFilterOptions,
  lineSummary,
  monthKey,
  monthName,
  pageLines,
  requestDays,
  shiftLabel,
  shortDate,
  isUniqueViolation,
  splitsToTargets,
  targetsMoveFixedLine,
  targetsTotalError,
  targetsTotalMessage,
  toEngineRules,
  warningsAddedMessage,
  warningsLabel,
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

  it("only warns about the lock when nothing is unfilled and no warning remains", () => {
    expect(confirmDescription(0, 0)).toBe(LOCKED);
  });

  it("counts one unfilled shift in the singular and several in the plural", () => {
    expect(confirmDescription(1, 0)).toBe(`1 shift is still unfilled. ${LOCKED}`);
    expect(confirmDescription(3, 0)).toBe(`3 shifts are still unfilled. ${LOCKED}`);
  });

  it("counts warnings alone, one and several", () => {
    expect(confirmDescription(0, 1)).toBe(`1 warning remains. ${LOCKED}`);
    expect(confirmDescription(0, 2)).toBe(`2 warnings remain. ${LOCKED}`);
  });

  it("states both counts when both exist", () => {
    expect(confirmDescription(3, 2)).toBe(
      `3 shifts are still unfilled and 2 warnings remain. ${LOCKED}`,
    );
    expect(confirmDescription(1, 1)).toBe(
      `1 shift is still unfilled and 1 warning remains. ${LOCKED}`,
    );
  });
});

describe("generateAgainDescription", () => {
  it("says only that the draft is replaced when there is nothing to lose", () => {
    expect(generateAgainDescription(0, 0)).toBe("The current draft is replaced.");
  });

  it("names the manual edits and the conflicts it discards", () => {
    expect(generateAgainDescription(1, 2)).toBe(
      "The current draft is replaced. This discards 1 manual edit and the 2 conflicts listed now.",
    );
    expect(generateAgainDescription(3, 1)).toBe(
      "The current draft is replaced. This discards 3 manual edits and the 1 conflict listed now.",
    );
  });

  it("names only what exists", () => {
    expect(generateAgainDescription(2, 0)).toBe(
      "The current draft is replaced. This discards 2 manual edits.",
    );
    expect(generateAgainDescription(0, 4)).toBe(
      "The current draft is replaced. This discards the 4 conflicts listed now.",
    );
  });
});

describe("warning counts", () => {
  it("counts warnings in the singular and the plural", () => {
    expect(warningsLabel(1)).toBe("1 warning");
    expect(warningsLabel(2)).toBe("2 warnings");
  });

  it("adds the warnings an edit introduced to the success message", () => {
    expect(warningsAddedMessage("Cell updated", 0)).toBe("Cell updated");
    expect(warningsAddedMessage("Cell updated", 1)).toBe("Cell updated. 1 warning added");
    expect(warningsAddedMessage("Worker replaced", 3)).toBe("Worker replaced. 3 warnings added");
  });
});

describe("toEngineRules", () => {
  const sources = {
    workDaysPerWeek: "default",
    breakDays: "default",
    breakCycleMonths: "default",
    annualOffDays: "default",
    shiftExceptionDays: "default",
    requirePositionMatch: "default",
    maxWorkingDaysPerMonth: "default",
  } as const;

  it("maps the four rules the engine reads", () => {
    expect(toEngineRules({ values: WORK_RULE_DEFAULTS, sources })).toEqual({
      workDaysPerWeek: 5,
      shiftExceptionDays: 7,
      requirePositionMatch: true,
      maxWorkingDaysPerMonth: 26,
    });
  });

  it("passes non-default values through unchanged and drops the rest", () => {
    const values = {
      ...WORK_RULE_DEFAULTS,
      workDaysPerWeek: 7 as const,
      shiftExceptionDays: 3,
      requirePositionMatch: false,
      maxWorkingDaysPerMonth: 20,
      breakDays: 9,
    };

    expect(toEngineRules({ values, sources })).toEqual({
      workDaysPerWeek: 7,
      shiftExceptionDays: 3,
      requirePositionMatch: false,
      maxWorkingDaysPerMonth: 20,
    });
  });
});

describe("cell edit messages", () => {
  it("states each refusal", () => {
    expect(CELL_DATE_MESSAGE).toBe("That day is not in this roster.");
    expect(CELL_SHIFT_MESSAGE).toBe("That shift is not available at this location.");
    expect(CELL_OTHER_LINE_MESSAGE).toBe(
      "This worker already has a row on that day in another line.",
    );
    expect(CELL_BUSY_MESSAGE).toBe("This worker already works on that day in another roster.");
    expect(CELL_WORKS_THAT_DAY_MESSAGE).toBe("This worker already works on that day.");
  });
});

describe("shiftLabel", () => {
  it("names Any shift for null", () => {
    expect(shiftLabel(null)).toBe("Any shift");
  });

  it("names the order of a shift", () => {
    expect(shiftLabel(1)).toBe("Shift 1");
    expect(shiftLabel(3)).toBe("Shift 3");
  });
});

describe("fixedSplit", () => {
  it("puts the day's headcount on the fixed shift", () => {
    expect(fixedSplit([2, 2], ["s1", "s2", "s3"], "s1")).toEqual([
      [2, 0, 0],
      [2, 0, 0],
    ]);
  });

  it("keeps zero-headcount days at zero", () => {
    expect(fixedSplit([6, 0, 4], ["s1", "s2"], "s2")).toEqual([
      [0, 6],
      [0, 0],
      [0, 4],
    ]);
  });

  it("follows the order of the shift ids", () => {
    expect(fixedSplit([3], ["s3", "s1", "s2"], "s2")).toEqual([[0, 0, 3]]);
  });
});

describe("targetsMoveFixedLine", () => {
  const fixed = [{ lineId: "l1", shiftId: "s1" }];
  const target = (shiftId: string, headcount: number, lineId = "l1") => ({
    lineId,
    shiftId,
    headcount,
  });

  it("is false for an Any shift line, whatever the split", () => {
    expect(
      targetsMoveFixedLine([{ lineId: "l1", shiftId: null }], [target("s1", 1), target("s2", 1)]),
    ).toBe(false);
  });

  it("is false when a fixed line keeps its shift", () => {
    expect(targetsMoveFixedLine(fixed, [target("s1", 2), target("s2", 0)])).toBe(false);
  });

  it("is true when a fixed line has headcount on another shift", () => {
    expect(targetsMoveFixedLine(fixed, [target("s1", 1), target("s2", 1)])).toBe(true);
  });

  it("ignores zero targets on other shifts and targets of other lines", () => {
    expect(targetsMoveFixedLine(fixed, [target("s2", 0), target("s2", 5, "l2")])).toBe(false);
  });
});

function workerRow(
  workerId: string,
  employeeId: string,
  name: string,
  cells: RosterCell[] = [],
): RosterWorkerRow {
  return { workerId, employeeId, name, replaced: false, cells };
}

const workCell = (shiftOrder: number): RosterCell => ({
  kind: "work",
  shiftOrder,
  edited: false,
  warning: false,
});
const offCell: RosterCell = { kind: "off", edited: false, warning: false };
const warnCell = (shiftOrder: number): RosterCell => ({
  kind: "work",
  shiftOrder,
  edited: false,
  warning: true,
});

function lineView(lineId: string, overrides: Partial<RosterLineView> = {}): RosterLineView {
  return {
    lineId,
    title: lineId,
    shiftLabel: "Any shift",
    perDay: [1],
    departmentId: "d1",
    departmentName: "Produksi",
    subDepartmentId: null,
    subDepartmentName: null,
    positionId: "p1",
    positionName: "Operator",
    shiftId: null,
    workers: [],
    unfilled: [],
    ...overrides,
  };
}

const NO_FILTERS: RosterLineFilters = {
  departmentId: null,
  subDepartmentId: null,
  positionId: null,
  shiftOrder: null,
  attention: false,
  search: "",
};

describe("filterLines", () => {
  const lines = [
    lineView("l1", { departmentId: "d1", subDepartmentId: "s1", positionId: "p1", shiftId: null }),
    lineView("l2", { departmentId: "d1", subDepartmentId: null, positionId: "p2", shiftId: "sh1" }),
    lineView("l3", { departmentId: "d2", subDepartmentId: "s2", positionId: "p1", shiftId: "sh2" }),
  ];
  const ids = (result: RosterLineView[]) => result.map((line) => line.lineId);

  it("keeps every line when nothing is filtered", () => {
    expect(filterLines(lines, NO_FILTERS)).toEqual(lines);
  });

  it("keeps the lines of the chosen department", () => {
    expect(ids(filterLines(lines, { ...NO_FILTERS, departmentId: "d1" }))).toEqual(["l1", "l2"]);
  });

  it("keeps the lines of the chosen sub-department, and drops a line with none", () => {
    expect(ids(filterLines(lines, { ...NO_FILTERS, subDepartmentId: "s1" }))).toEqual(["l1"]);
  });

  it("keeps the lines of the chosen position", () => {
    expect(ids(filterLines(lines, { ...NO_FILTERS, positionId: "p1" }))).toEqual(["l1", "l3"]);
  });

  it("needs a line to match every filter that is set", () => {
    expect(
      ids(
        filterLines(lines, {
          ...NO_FILTERS,
          departmentId: "d1",
          subDepartmentId: "s1",
          positionId: "p1",
        }),
      ),
    ).toEqual(["l1"]);
  });

  describe("shift", () => {
    // An Any shift line mixes shifts. A line fixed to a shift only has that shift's cells.
    const shifted = [
      lineView("any", {
        shiftId: null,
        workers: [
          workerRow("w1", "E1", "Ani", [workCell(1), offCell, workCell(2)]),
          workerRow("w2", "E2", "Bob", [workCell(2), workCell(3)]),
          workerRow("w3", "E3", "Cut", [offCell, offCell]),
        ],
      }),
      lineView("fixed2", {
        shiftId: "sh2",
        workers: [workerRow("w4", "E4", "Dedi", [workCell(2), workCell(2)])],
      }),
    ];
    const workersOf = (result: RosterLineView[]) =>
      result.map((line) => [line.lineId, line.workers.map((worker) => worker.workerId)]);

    it("keeps the workers who work the chosen shift on any day, and all their cells", () => {
      const result = filterLines(shifted, { ...NO_FILTERS, shiftOrder: 1 });

      expect(workersOf(result)).toEqual([["any", ["w1"]]]);
      expect(result[0].workers[0].cells).toHaveLength(3);
    });

    it("drops a line fixed to another shift, since none of its workers work the chosen one", () => {
      expect(workersOf(filterLines(shifted, { ...NO_FILTERS, shiftOrder: 3 }))).toEqual([
        ["any", ["w2"]],
      ]);
    });

    it("keeps the line fixed to the chosen shift, with its workers", () => {
      expect(workersOf(filterLines(shifted, { ...NO_FILTERS, shiftOrder: 2 }))).toEqual([
        ["any", ["w1", "w2"]],
        ["fixed2", ["w4"]],
      ]);
    });

    it("leaves out a worker with only off days, and a line left with no workers", () => {
      expect(filterLines(shifted, { ...NO_FILTERS, shiftOrder: 4 })).toEqual([]);
    });

    it("combines with search and the line filters", () => {
      expect(
        workersOf(filterLines(shifted, { ...NO_FILTERS, shiftOrder: 2, search: "bob" })),
      ).toEqual([["any", ["w2"]]]);
      expect(
        workersOf(filterLines(shifted, { ...NO_FILTERS, shiftOrder: 2, positionId: "p1" })).length,
      ).toBe(2);
    });
  });

  describe("needs attention", () => {
    const flagged = [
      // Short of workers, no worker with a warning.
      lineView("short", {
        unfilled: [{ date: "2026-11-09", shiftOrder: 1, shortfall: 1 }],
        workers: [workerRow("w1", "E1", "Ani", [workCell(1)])],
      }),
      // Full, with one worker whose cell breaks a rule.
      lineView("warned", {
        workers: [
          workerRow("w2", "E2", "Bob", [workCell(1), warnCell(2)]),
          workerRow("w3", "E3", "Cut", [workCell(1)]),
        ],
      }),
      // Nothing to look at.
      lineView("fine", { workers: [workerRow("w4", "E4", "Dedi", [workCell(1)])] }),
    ];
    const attention = { ...NO_FILTERS, attention: true };

    it("keeps a line that is short, and shows none of its workers", () => {
      const [first] = filterLines(flagged, attention);

      expect([first.lineId, first.workers, first.unfilled.length]).toEqual(["short", [], 1]);
    });

    it("keeps only the workers with a warning, and drops a line with no problem", () => {
      const result = filterLines(flagged, attention);

      expect(result.map((line) => [line.lineId, line.workers.map((w) => w.workerId)])).toEqual([
        ["short", []],
        ["warned", ["w2"]],
      ]);
    });

    it("keeps everything when it is off", () => {
      expect(filterLines(flagged, NO_FILTERS)).toEqual(flagged);
    });

    it("combines with search: a worker has to match the search and have a warning", () => {
      const bob = filterLines(flagged, { ...attention, search: "bob" });
      const cut = filterLines(flagged, { ...attention, search: "cut" });

      expect(bob.map((line) => [line.lineId, line.workers.map((w) => w.workerId)])).toEqual([
        ["warned", ["w2"]],
      ]);
      // Cut matches but has no warning, and Ani's line has nobody matching.
      expect(cut).toEqual([]);
    });
  });

  describe("search", () => {
    const searchable = [
      lineView("l1", {
        workers: [workerRow("w1", "E-001", "Budi Santoso"), workerRow("w2", "E-002", "Sari Dewi")],
      }),
      lineView("l2", { workers: [workerRow("w3", "E-003", "Budiman")] }),
      lineView("l3", { workers: [] }),
    ];

    it("keeps only the workers whose name matches, in any letter case", () => {
      const result = filterLines(searchable, { ...NO_FILTERS, search: "budi" });

      expect(result.map((line) => [line.lineId, line.workers.map((w) => w.workerId)])).toEqual([
        ["l1", ["w1"]],
        ["l2", ["w3"]],
      ]);
    });

    it("matches an employee ID and ignores spaces around the text", () => {
      const result = filterLines(searchable, { ...NO_FILTERS, search: "  e-002 " });

      expect(result.map((line) => [line.lineId, line.workers.map((w) => w.workerId)])).toEqual([
        ["l1", ["w2"]],
      ]);
    });

    it("drops a line with no workers while searching, and keeps it when not", () => {
      expect(filterLines(searchable, { ...NO_FILTERS, search: "e-" }).map((l) => l.lineId)).toEqual([
        "l1",
        "l2",
      ]);
      expect(filterLines(searchable, NO_FILTERS).map((l) => l.lineId)).toEqual(["l1", "l2", "l3"]);
    });

    it("treats a blank search as no search", () => {
      expect(filterLines(searchable, { ...NO_FILTERS, search: "   " })).toEqual(searchable);
    });

    it("combines with the other filters", () => {
      const mixed = [
        lineView("l1", { positionId: "p1", workers: [workerRow("w1", "E-001", "Budi")] }),
        lineView("l2", { positionId: "p2", workers: [workerRow("w2", "E-002", "Budi")] }),
      ];

      expect(
        filterLines(mixed, { ...NO_FILTERS, positionId: "p2", search: "budi" }).map((l) => l.lineId),
      ).toEqual(["l2"]);
    });
  });
});

describe("lineFilterOptions", () => {
  const lines = [
    lineView("l1", {
      departmentId: "d2",
      departmentName: "Produksi",
      subDepartmentId: "s1",
      subDepartmentName: "Packing",
      positionId: "p2",
      positionName: "Operator",
    }),
    lineView("l2", {
      departmentId: "d1",
      departmentName: "Gudang",
      subDepartmentId: null,
      subDepartmentName: null,
      positionId: "p1",
      positionName: "Forklift",
    }),
    lineView("l3", {
      departmentId: "d2",
      departmentName: "Produksi",
      subDepartmentId: "s2",
      subDepartmentName: "Assembly",
      positionId: "p2",
      positionName: "Operator",
    }),
  ];

  it("lists each department, sub-department, and position once, by name", () => {
    expect(lineFilterOptions(lines, null)).toEqual({
      departments: [
        { id: "d1", name: "Gudang" },
        { id: "d2", name: "Produksi" },
      ],
      subDepartments: [
        { id: "s2", name: "Assembly" },
        { id: "s1", name: "Packing" },
      ],
      positions: [
        { id: "p1", name: "Forklift" },
        { id: "p2", name: "Operator" },
      ],
    });
  });

  it("offers only the sub-departments of the chosen department", () => {
    expect(lineFilterOptions(lines, "d1").subDepartments).toEqual([]);
    expect(lineFilterOptions(lines, "d2").subDepartments).toEqual([
      { id: "s2", name: "Assembly" },
      { id: "s1", name: "Packing" },
    ]);
  });

  it("gives empty lists for no lines", () => {
    expect(lineFilterOptions([], null)).toEqual({ departments: [], subDepartments: [], positions: [] });
  });
});

describe("pageLines", () => {
  const rows = (lineId: string, count: number) =>
    Array.from({ length: count }, (_, index) => workerRow(`${lineId}w${index + 1}`, `E${index}`, `W${index}`));
  const lines = [
    lineView("l1", { workers: rows("l1", 3) }),
    lineView("l2", { workers: rows("l2", 4) }),
    lineView("l3", { workers: rows("l3", 1) }),
  ];
  const shape = (result: ReturnType<typeof pageLines>) =>
    result.slices.map((slice) => [slice.lineId, slice.workers.length, slice.endsHere]);

  it("cuts by worker rows across lines, and repeats the header of a line the page cuts", () => {
    expect(shape(pageLines(lines, 1, 5))).toEqual([
      ["l1", 3, true],
      ["l2", 2, false],
    ]);
    expect(shape(pageLines(lines, 2, 5))).toEqual([
      ["l2", 2, true],
      ["l3", 1, true],
    ]);
  });

  it("keeps the workers of a cut line in order across pages", () => {
    const first = pageLines(lines, 1, 5).slices[1].workers.map((w) => w.workerId);
    const second = pageLines(lines, 2, 5).slices[0].workers.map((w) => w.workerId);

    expect([...first, ...second]).toEqual(["l2w1", "l2w2", "l2w3", "l2w4"]);
  });

  it("ends a line on the page that holds its last worker when the page ends exactly there", () => {
    expect(shape(pageLines(lines, 1, 3))).toEqual([["l1", 3, true]]);
    expect(shape(pageLines(lines, 2, 3))).toEqual([["l2", 3, false]]);
  });

  it("counts the pages from the worker rows", () => {
    expect(pageLines(lines, 1, 5).pageCount).toBe(2);
    expect(pageLines(lines, 1, 8).pageCount).toBe(1);
    expect(pageLines(lines, 1, 3).pageCount).toBe(3);
  });

  it("counts a line with no workers as one row, so its Add worker button is reachable", () => {
    const withEmpty = [lineView("e1", { workers: [] }), lineView("l1", { workers: rows("l1", 2) })];

    expect(shape(pageLines(withEmpty, 1, 1))).toEqual([["e1", 0, true]]);
    expect(shape(pageLines(withEmpty, 2, 1))).toEqual([["l1", 1, false]]);
    expect(pageLines(withEmpty, 1, 1).pageCount).toBe(3);
  });

  it("shows the last page when the page asked for is past the end", () => {
    const result = pageLines(lines, 9, 5);

    expect(result.page).toBe(2);
    expect(shape(result)).toEqual(shape(pageLines(lines, 2, 5)));
  });

  it("shows page 1 of 1 and no slices for no lines", () => {
    expect(pageLines([], 3, 10)).toEqual({ slices: [], page: 1, pageCount: 1 });
  });
});

describe("lineSummary", () => {
  const lines = [
    lineView("l1", { workers: [workerRow("w1", "E1", "A"), workerRow("w2", "E2", "B")] }),
    lineView("l2", { workers: [workerRow("w3", "E3", "C")] }),
  ];

  it("counts the workers and lines shown", () => {
    expect(lineSummary(lines, 2)).toBe("3 workers in 2 lines");
  });

  it("says how many of the roster's lines are shown when some are filtered out", () => {
    expect(lineSummary([lines[1]], 2)).toBe("1 worker in 1 of 2 lines");
  });

  it("counts a worker once when the worker has rows in two lines", () => {
    const shared = [
      lineView("l1", { workers: [workerRow("w1", "E1", "A"), workerRow("w2", "E2", "B")] }),
      lineView("l2", { workers: [workerRow("w1", "E1", "A")] }),
    ];

    expect(lineSummary(shared, 2)).toBe("2 workers in 2 lines");
  });

  it("uses the singular for one line", () => {
    expect(lineSummary([lines[0]], 1)).toBe("2 workers in 1 line");
  });

  it("handles no lines shown", () => {
    expect(lineSummary([], 3)).toBe("0 workers in 0 of 3 lines");
  });
});
