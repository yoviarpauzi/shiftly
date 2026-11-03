import { describe, expect, it } from "vitest";

import type { EvalCell, EvaluateInput } from "@/types/rosters";

import { evaluateRoster } from "./roster-evaluation";
import { requestDays } from "./roster-rules";

const DAYS = requestDays("2026-11-09", "weekly");

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

// The first days of the week as work cells on one shift.
const run = (count: number, shiftOrder = 1, overrides: Partial<EvalCell> = {}) =>
  DAYS.slice(0, count).map((date) => work(date, shiftOrder, overrides));

const input = (overrides: Partial<EvaluateInput> = {}): EvaluateInput => ({
  days: DAYS,
  lines: [{ id: "l1", positionId: "p1", positionName: "Operator Produksi" }],
  workers: [{ id: "w1", endContract: "2027-01-01", positionIds: ["p1"] }],
  cells: run(5),
  targets: [],
  rules: {
    workDaysPerWeek: 5,
    shiftExceptionDays: 7,
    requirePositionMatch: true,
    maxWorkingDaysPerMonth: 26,
  },
  history: [
    {
      workerId: "w1",
      lastWorkDate: null,
      lastShiftOrder: null,
      consecutiveWorkDays: 0,
      monthWorkDays: {},
    },
  ],
  ...overrides,
});

describe("evaluateRoster", () => {
  it("gives no warning for a clean row of 5 work days", () => {
    expect(evaluateRoster(input())).toEqual([]);
  });

  it("warns on the 6th work day of the week", () => {
    expect(evaluateRoster(input({ cells: run(6) }))).toEqual([
      {
        code: "weekly",
        lineId: "l1",
        workerId: "w1",
        date: "2026-11-14",
        shiftOrder: 1,
        message: "Would exceed 5 working days this week.",
      },
    ]);
  });

  it("counts work days on two lines of the same worker together", () => {
    const cells = [...run(3), ...DAYS.slice(3, 6).map((date) => work(date, 1, { lineId: "l2" }))];
    const warnings = evaluateRoster(
      input({
        cells,
        lines: [
          { id: "l1", positionId: "p1", positionName: "Operator Produksi" },
          { id: "l2", positionId: "p1", positionName: "Operator Produksi" },
        ],
      }),
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      code: "weekly",
      lineId: "l2",
      date: "2026-11-14",
    });
  });

  describe("shift move", () => {
    const message = "Moves from shift 3 to shift 1 on Tue 10 Nov, before 7 working days.";

    it("warns on a move to a lower shift before the exception days", () => {
      expect(evaluateRoster(input({ cells: [work(DAYS[0], 3), work(DAYS[1], 1)] }))).toEqual([
        {
          code: "shiftMove",
          lineId: "l1",
          workerId: "w1",
          date: "2026-11-10",
          shiftOrder: 1,
          message,
        },
      ]);
    });

    it("gives no warning with a gap day between", () => {
      expect(evaluateRoster(input({ cells: [work(DAYS[0], 3), work(DAYS[2], 1)] }))).toEqual([]);
    });

    it("gives no warning for a move to a higher shift", () => {
      expect(evaluateRoster(input({ cells: [work(DAYS[0], 1), work(DAYS[1], 3)] }))).toEqual([]);
    });

    it("counts the history chain only when it ends the day before the first day", () => {
      const history = (lastWorkDate: string) => [
        {
          workerId: "w1",
          lastWorkDate,
          lastShiftOrder: 3,
          consecutiveWorkDays: 2,
          monthWorkDays: {},
        },
      ];

      expect(
        evaluateRoster(input({ cells: [work(DAYS[0], 1)], history: history("2026-11-08") })),
      ).toEqual([
        expect.objectContaining({
          code: "shiftMove",
          message: "Moves from shift 3 to shift 1 on Mon 9 Nov, before 7 working days.",
        }),
      ]);
      expect(
        evaluateRoster(input({ cells: [work(DAYS[0], 1)], history: history("2026-11-07") })),
      ).toEqual([]);
    });

    it("lifts the warning once the exception days are worked in a row", () => {
      const cells = [work(DAYS[0], 3), work(DAYS[1], 3), work(DAYS[2], 1)];
      const base = input({ cells });

      expect(evaluateRoster(base)).toHaveLength(1);
      expect(
        evaluateRoster({
          ...base,
          rules: { ...base.rules, shiftExceptionDays: 2 },
        }),
      ).toEqual([]);
    });
  });

  it("warns once per month when the monthly limit would be exceeded", () => {
    const history = [
      {
        workerId: "w1",
        lastWorkDate: null,
        lastShiftOrder: null,
        consecutiveWorkDays: 0,
        monthWorkDays: { "2026-11": 25 },
      },
    ];

    expect(evaluateRoster(input({ cells: run(3), history }))).toEqual([
      {
        code: "monthly",
        lineId: "l1",
        workerId: "w1",
        date: "2026-11-10",
        shiftOrder: 1,
        message: "Would exceed 26 working days in November.",
      },
    ]);
  });

  describe("position", () => {
    const lacking = {
      workers: [{ id: "w1", endContract: "2027-01-01", positionIds: ["p2"] }],
    };

    it("warns once per worker per line", () => {
      expect(evaluateRoster(input(lacking))).toEqual([
        {
          code: "position",
          lineId: "l1",
          workerId: "w1",
          date: "2026-11-09",
          shiftOrder: 1,
          message: "Does not have the position Operator Produksi.",
        },
      ]);
    });

    it("gives no warning when the match is not required", () => {
      const base = input(lacking);

      expect(
        evaluateRoster({
          ...base,
          rules: { ...base.rules, requirePositionMatch: false },
        }),
      ).toEqual([]);
    });
  });

  describe("contract", () => {
    const ending = {
      workers: [{ id: "w1", endContract: "2026-11-11", positionIds: ["p1"] }],
    };

    it("warns once per worker on the first work day after the contract ends", () => {
      expect(evaluateRoster(input(ending))).toEqual([
        {
          code: "contract",
          lineId: "l1",
          workerId: "w1",
          date: "2026-11-12",
          shiftOrder: 1,
          message: "Contract ends 2026-11-11.",
        },
      ]);
    });

    it("gives nothing for an off cell after the contract ends", () => {
      expect(evaluateRoster(input({ ...ending, cells: [...run(3), off(DAYS[4])] }))).toEqual([]);
    });
  });

  describe("over", () => {
    const cells = ["w1", "w2", "w3"].map((workerId) => work(DAYS[1], 1, { workerId }));
    const workers = ["w1", "w2", "w3"].map((id) => ({
      id,
      endContract: "2027-01-01",
      positionIds: ["p1"],
    }));
    const target = (headcount: number) => [
      { lineId: "l1", date: DAYS[1], shiftOrder: 1, headcount },
    ];

    it("warns when more workers are assigned than the target", () => {
      expect(evaluateRoster(input({ cells, workers, targets: target(2), history: [] }))).toEqual([
        {
          code: "over",
          lineId: "l1",
          workerId: null,
          date: "2026-11-10",
          shiftOrder: 1,
          message: "Tue 10 Nov · Shift 1: 3 assigned, 2 needed.",
        },
      ]);
    });

    it("gives no warning at exactly the target", () => {
      expect(evaluateRoster(input({ cells, workers, targets: target(3), history: [] }))).toEqual(
        [],
      );
    });

    it("gives no warning when the group has no target row", () => {
      expect(evaluateRoster(input({ cells, workers, targets: [], history: [] }))).toEqual([]);
    });
  });

  it("never warns on off and break cells", () => {
    const cells = [...DAYS.map((date) => off(date)), { ...off(DAYS[0]), kind: "break" as const }];
    const workers = [{ id: "w1", endContract: "2020-01-01", positionIds: [] }];

    expect(evaluateRoster(input({ cells, workers }))).toEqual([]);
  });

  it("sorts by date, then line id, then code, then worker id with a null worker last", () => {
    const base = input({
      lines: [
        { id: "l1", positionId: "p1", positionName: "Operator Produksi" },
        { id: "l2", positionId: "p1", positionName: "Operator Produksi" },
      ],
      workers: [
        { id: "w1", endContract: "2027-01-01", positionIds: ["p2"] },
        { id: "w2", endContract: "2027-01-01", positionIds: ["p2"] },
      ],
      cells: [
        work(DAYS[0], 1, { lineId: "l2", workerId: "w2" }),
        work(DAYS[0], 1, { lineId: "l1", workerId: "w2" }),
        work(DAYS[0], 1, { lineId: "l1", workerId: "w1" }),
      ],
      targets: [{ lineId: "l1", date: DAYS[0], shiftOrder: 1, headcount: 1 }],
      history: [],
    });

    expect(evaluateRoster(base).map((w) => [w.date, w.lineId, w.code, w.workerId])).toEqual([
      ["2026-11-09", "l1", "over", null],
      ["2026-11-09", "l1", "position", "w1"],
      ["2026-11-09", "l1", "position", "w2"],
      ["2026-11-09", "l2", "position", "w2"],
    ]);
  });

  it("does not mutate its input", () => {
    const base = input({ cells: run(6).reverse() });
    const copy = structuredClone(base);

    evaluateRoster(base);

    expect(base).toEqual(copy);
  });
});
