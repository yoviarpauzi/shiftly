import { describe, expect, it } from "vitest";

import type { EvalCell, RosterWarning } from "@/types/rosters";

import { applyCellChange, cellHardError, introducedWarnings, shortageRows } from "./roster-cell-edit";
import {
  CELL_BUSY_MESSAGE,
  CELL_DATE_MESSAGE,
  CELL_OTHER_LINE_MESSAGE,
  CELL_SHIFT_MESSAGE,
  REPLACEMENT_WORKER_MISSING_MESSAGE,
} from "./roster-rules";

function work(date: string, shiftOrder = 1, overrides: Partial<EvalCell> = {}): EvalCell {
  return {
    lineId: "l1",
    workerId: "w1",
    date,
    kind: "work",
    shiftOrder,
    shiftId: `s${shiftOrder}`,
    ...overrides,
  };
}

function off(date: string, overrides: Partial<EvalCell> = {}): EvalCell {
  return {
    lineId: "l1",
    workerId: "w1",
    date,
    kind: "off",
    shiftOrder: null,
    shiftId: null,
    ...overrides,
  };
}

describe("applyCellChange", () => {
  const change = { lineId: "l1", workerId: "w1", date: "2026-11-09" };

  it("replaces a work cell with one on a new shift", () => {
    const cells = [work("2026-11-09", 1), work("2026-11-10", 1)];

    expect(
      applyCellChange(cells, { ...change, to: { kind: "work", shiftId: "s2", shiftOrder: 2 } }),
    ).toEqual([work("2026-11-10", 1), work("2026-11-09", 2)]);
  });

  it("sets an off cell over a work cell", () => {
    expect(applyCellChange([work("2026-11-09", 2)], { ...change, to: { kind: "off" } })).toEqual([
      off("2026-11-09"),
    ]);
  });

  it("sets a break cell with no shift", () => {
    expect(applyCellChange([], { ...change, to: { kind: "break" } })).toEqual([
      off("2026-11-09", { kind: "break" }),
    ]);
  });

  it("removes the cell on clear", () => {
    const cells = [work("2026-11-09"), work("2026-11-10")];

    expect(applyCellChange(cells, { ...change, to: { kind: "clear" } })).toEqual([
      work("2026-11-10"),
    ]);
  });

  it("adds a cell for a worker with none that day", () => {
    const cells = [work("2026-11-10")];

    expect(
      applyCellChange(cells, { ...change, to: { kind: "work", shiftId: "s1", shiftOrder: 1 } }),
    ).toEqual([work("2026-11-10"), work("2026-11-09", 1)]);
  });

  it("removes a same-day cell of another line", () => {
    const cells = [work("2026-11-09", 1, { lineId: "l2" }), work("2026-11-09", 1, { workerId: "w2" })];

    expect(applyCellChange(cells, { ...change, to: { kind: "off" } })).toEqual([
      work("2026-11-09", 1, { workerId: "w2" }),
      off("2026-11-09"),
    ]);
  });

  it("does not mutate the cells", () => {
    const cells = [work("2026-11-09")];
    const snapshot = structuredClone(cells);
    const result = applyCellChange(cells, { ...change, to: { kind: "clear" } });

    expect(cells).toEqual(snapshot);
    expect(result).not.toBe(cells);
  });
});

describe("introducedWarnings", () => {
  const warning = (overrides: Partial<RosterWarning> = {}): RosterWarning => ({
    code: "weekly",
    lineId: "l1",
    workerId: "w1",
    date: "2026-11-09",
    shiftOrder: 1,
    message: "Would exceed 5 working days this week.",
    ...overrides,
  });

  it("keeps a warning whose key is new", () => {
    const added = warning({ code: "monthly", message: "Monthly." });

    expect(introducedWarnings([warning()], [warning(), added])).toEqual([added]);
  });

  it("keeps a warning that differs by worker, line, or date", () => {
    const others = [
      warning({ workerId: "w2" }),
      warning({ lineId: "l2" }),
      warning({ date: "2026-11-10" }),
    ];

    expect(introducedWarnings([warning()], others)).toEqual(others);
  });

  it("drops a warning whose key already exists, whatever its message", () => {
    expect(introducedWarnings([warning()], [warning({ message: "Another text." })])).toEqual([]);
  });

  it("gives none when both are equal", () => {
    expect(introducedWarnings([warning()], [warning()])).toEqual([]);
  });

  it("matches a warning about a cell group by its null worker", () => {
    const group = warning({ code: "over", workerId: null });

    expect(introducedWarnings([group], [group])).toEqual([]);
    expect(introducedWarnings([], [group])).toEqual([group]);
  });
});

describe("cellHardError", () => {
  const clean = {
    date: "2026-11-09",
    days: ["2026-11-09", "2026-11-10"],
    workerActive: true,
    shiftKnown: true,
    rowsThatDay: [],
    targetLineId: "l1",
    busyElsewhere: false,
  };

  it("is null for a clean change", () => {
    expect(cellHardError(clean)).toBeNull();
  });

  it("refuses a date outside the roster", () => {
    expect(cellHardError({ ...clean, date: "2026-12-01" })).toBe(CELL_DATE_MESSAGE);
  });

  it("refuses a worker who is not active", () => {
    expect(cellHardError({ ...clean, workerActive: false })).toBe(
      REPLACEMENT_WORKER_MISSING_MESSAGE,
    );
  });

  it("refuses an unknown shift", () => {
    expect(cellHardError({ ...clean, shiftKnown: false })).toBe(CELL_SHIFT_MESSAGE);
  });

  it("refuses a row that day in another line", () => {
    expect(cellHardError({ ...clean, rowsThatDay: [{ lineId: "l2" }] })).toBe(
      CELL_OTHER_LINE_MESSAGE,
    );
  });

  it("refuses a worker busy in another roster", () => {
    expect(cellHardError({ ...clean, busyElsewhere: true })).toBe(CELL_BUSY_MESSAGE);
  });

  it("is clean for a worker with a row that day in this same line", () => {
    expect(cellHardError({ ...clean, rowsThatDay: [{ lineId: "l1" }] })).toBeNull();
  });

  it("reports the first reason when several apply", () => {
    const all = {
      ...clean,
      date: "2026-12-01",
      workerActive: false,
      shiftKnown: false,
      rowsThatDay: [{ lineId: "l2" }],
      busyElsewhere: true,
    };

    expect(cellHardError(all)).toBe(CELL_DATE_MESSAGE);
    expect(cellHardError({ ...all, date: "2026-11-09" })).toBe(
      REPLACEMENT_WORKER_MISSING_MESSAGE,
    );
    expect(cellHardError({ ...all, date: "2026-11-09", workerActive: true })).toBe(
      CELL_SHIFT_MESSAGE,
    );
    expect(
      cellHardError({ ...all, date: "2026-11-09", workerActive: true, shiftKnown: true }),
    ).toBe(CELL_OTHER_LINE_MESSAGE);
    expect(
      cellHardError({
        ...all,
        date: "2026-11-09",
        workerActive: true,
        shiftKnown: true,
        rowsThatDay: [],
      }),
    ).toBe(CELL_BUSY_MESSAGE);
  });
});

describe("shortageRows", () => {
  const target = (overrides = {}) => ({
    lineId: "l1",
    date: "2026-11-09",
    shiftId: "s1",
    headcount: 2,
    ...overrides,
  });

  it("gives nothing for a full shift", () => {
    const cells = [work("2026-11-09"), work("2026-11-09", 1, { workerId: "w2" })];

    expect(shortageRows({ targets: [target()], cells, previous: [] })).toEqual([]);
  });

  it("gives a row for a short shift", () => {
    expect(shortageRows({ targets: [target()], cells: [work("2026-11-09")], previous: [] })).toEqual([
      { lineId: "l1", date: "2026-11-09", shiftId: "s1", shortfall: 1, message: "Short by 1." },
    ]);
  });

  it("counts only work cells of that line, date, and shift", () => {
    const cells = [
      off("2026-11-09"),
      work("2026-11-09", 2, { workerId: "w2" }),
      work("2026-11-09", 1, { workerId: "w3", lineId: "l2" }),
      work("2026-11-10", 1, { workerId: "w4" }),
    ];

    expect(shortageRows({ targets: [target()], cells, previous: [] })[0].shortfall).toBe(2);
  });

  it("gives nothing for an over-full shift", () => {
    const cells = ["w1", "w2", "w3"].map((workerId) => work("2026-11-09", 1, { workerId }));

    expect(shortageRows({ targets: [target()], cells, previous: [] })).toEqual([]);
  });

  it("gives nothing for a target with no headcount", () => {
    expect(shortageRows({ targets: [target({ headcount: 0 })], cells: [], previous: [] })).toEqual(
      [],
    );
  });

  it("keeps the engine message when the shortfall is the same", () => {
    const previous = [
      {
        lineId: "l1",
        date: "2026-11-09",
        shiftId: "s1",
        shortfall: 1,
        message: "No worker has the position.",
      },
    ];

    expect(shortageRows({ targets: [target()], cells: [work("2026-11-09")], previous })).toEqual([
      {
        lineId: "l1",
        date: "2026-11-09",
        shiftId: "s1",
        shortfall: 1,
        message: "No worker has the position.",
      },
    ]);
  });

  it("writes a new message when the shortfall changed", () => {
    const previous = [
      {
        lineId: "l1",
        date: "2026-11-09",
        shiftId: "s1",
        shortfall: 1,
        message: "No worker has the position.",
      },
    ];

    expect(shortageRows({ targets: [target()], cells: [], previous })[0]).toMatchObject({
      shortfall: 2,
      message: "Short by 2.",
    });
  });

  it("does not reuse a message from another shift or one with no shift", () => {
    const previous = [
      { lineId: "l1", date: "2026-11-09", shiftId: "s2", shortfall: 2, message: "Other shift." },
      { lineId: "l1", date: "2026-11-09", shiftId: null, shortfall: 2, message: "No shift." },
    ];

    expect(shortageRows({ targets: [target()], cells: [], previous })[0].message).toBe(
      "Short by 2.",
    );
  });

  it("sorts by date, line id, then shift id", () => {
    const targets = [
      target({ date: "2026-11-10", lineId: "l1", shiftId: "s1" }),
      target({ date: "2026-11-09", lineId: "l2", shiftId: "s1" }),
      target({ date: "2026-11-09", lineId: "l1", shiftId: "s2" }),
      target({ date: "2026-11-09", lineId: "l1", shiftId: "s1" }),
    ];

    expect(
      shortageRows({ targets, cells: [], previous: [] }).map((row) => [
        row.date,
        row.lineId,
        row.shiftId,
      ]),
    ).toEqual([
      ["2026-11-09", "l1", "s1"],
      ["2026-11-09", "l1", "s2"],
      ["2026-11-09", "l2", "s1"],
      ["2026-11-10", "l1", "s1"],
    ]);
  });
});
