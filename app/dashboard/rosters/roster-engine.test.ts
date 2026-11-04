import { describe, expect, it } from "vitest";

import type {
  EngineConflict,
  EngineRules,
  EngineTarget,
  EngineWorker,
  RosterEngineInput,
  RosterEngineOutput,
} from "@/types/rosters";

import { generateRoster } from "./roster-engine";
import { requestDays } from "./roster-rules";

const FIRST_DAY = "2026-11-09";
const DAYS = requestDays(FIRST_DAY, "weekly");
const SHIFTS = [
  { id: "s1", order: 1 },
  { id: "s2", order: 2 },
  { id: "s3", order: 3 },
];
const RULES: EngineRules = {
  workDaysPerWeek: 5,
  shiftExceptionDays: 7,
  requirePositionMatch: true,
  maxWorkingDaysPerMonth: 26,
};

const worker = (n: number, overrides: Partial<EngineWorker> = {}): EngineWorker => ({
  id: `w${n}`,
  employeeId: `EMP-010${n}`,
  endContract: "2027-01-01",
  positionIds: ["p1"],
  workDaysPerWeek: null,
  ...overrides,
});

const target = (
  date: string,
  shiftId: string,
  headcount = 1,
  lineId = "l1",
): EngineTarget => ({ lineId, date, shiftId, headcount });

const input = (overrides: Partial<RosterEngineInput> = {}): RosterEngineInput => ({
  days: DAYS,
  lines: [{ id: "l1", positionId: "p1" }],
  targets: [],
  shifts: SHIFTS,
  workers: [worker(1), worker(2), worker(3)],
  rules: RULES,
  history: [],
  ...overrides,
});

const noHistory = (workerId: string, overrides: Record<string, unknown> = {}) => ({
  workerId,
  lastWorkDate: null,
  lastShiftOrder: null,
  consecutiveWorkDays: 0,
  monthWorkDays: {},
  ...overrides,
});

const works = (output: RosterEngineOutput) =>
  output.assignments
    .filter((a) => a.kind === "work")
    .map((a) => `${a.date}:${a.workerId}:${a.shiftId}`);

const conflictOf = (
  date: string,
  shiftId: string,
  shortfall: number,
  message: string,
  lineId = "l1",
): EngineConflict => ({ lineId, date, shiftId, code: "shortage", shortfall, message });

describe("generateRoster: filling a target", () => {
  it("fills a target with the workers of the lowest employee ID", () => {
    const output = generateRoster(input({ targets: [target(FIRST_DAY, "s1", 2)] }));

    expect(works(output)).toEqual([`${FIRST_DAY}:w1:s1`, `${FIRST_DAY}:w2:s1`]);
    expect(output.conflicts).toEqual([]);
  });

  it("gives nothing for a target with a headcount of zero, and fills shifts in shift order", () => {
    const output = generateRoster(
      input({
        targets: [
          target(FIRST_DAY, "s2", 1),
          target(FIRST_DAY, "s1", 1),
          target(FIRST_DAY, "s3", 0),
        ],
        workers: [worker(1), worker(2)],
      }),
    );

    expect(works(output)).toEqual([`${FIRST_DAY}:w1:s1`, `${FIRST_DAY}:w2:s2`]);
    expect(output.conflicts).toEqual([]);
  });

  it("never writes a break assignment, and no conflict for a day with no target", () => {
    const output = generateRoster(input({ targets: [target(FIRST_DAY, "s1", 1)] }));

    expect(output.assignments.every((a) => a.kind === "work" || a.kind === "off")).toBe(true);
    expect(output.conflicts).toEqual([]);
  });
});

describe("generateRoster: determinism", () => {
  it("gives the same output for the same input, and when every array is reversed", () => {
    const base = input({
      lines: [
        { id: "l1", positionId: "p1" },
        { id: "l2", positionId: "p2" },
      ],
      workers: [
        worker(1),
        worker(2, { positionIds: ["p1", "p2"] }),
        worker(3, { positionIds: ["p2"] }),
        worker(4),
        worker(5, { positionIds: ["p2"], endContract: "2026-11-12" }),
        worker(6, { employeeId: "emp-0100" }),
      ],
      targets: [
        ...DAYS.slice(0, 5).map((d) => target(d, "s1", 2, "l1")),
        ...DAYS.slice(0, 5).map((d) => target(d, "s2", 1, "l1")),
        ...DAYS.slice(0, 6).map((d) => target(d, "s1", 2, "l2")),
        target(DAYS[6], "s3", 1, "l2"),
      ],
      history: [
        noHistory("w1", { lastWorkDate: "2026-11-08", lastShiftOrder: 2, consecutiveWorkDays: 3 }),
        noHistory("w4", { monthWorkDays: { "2026-11": 20 } }),
      ],
    });
    const reversed: RosterEngineInput = {
      ...base,
      days: [...base.days].reverse(),
      lines: [...base.lines].reverse(),
      targets: [...base.targets].reverse(),
      shifts: [...base.shifts].reverse(),
      workers: [...base.workers].reverse(),
      history: [...base.history].reverse(),
    };

    const first = generateRoster(base);

    expect(generateRoster(base)).toEqual(first);
    expect(generateRoster(reversed)).toEqual(first);
    expect(first.assignments.length).toBeGreaterThan(0);
  });

  it("orders the output by date, line, shift order, then employee ID", () => {
    const output = generateRoster(
      input({
        lines: [
          { id: "l1", positionId: "p1" },
          { id: "l2", positionId: "p1" },
        ],
        workers: [worker(1), worker(2), worker(3), worker(4)],
        targets: [
          target(FIRST_DAY, "s2", 1, "l1"),
          target(FIRST_DAY, "s1", 1, "l2"),
          target(FIRST_DAY, "s1", 1, "l1"),
        ],
      }),
    );

    expect(
      output.assignments.filter((a) => a.kind === "work").map((a) => [a.lineId, a.shiftId, a.workerId]),
    ).toEqual([
      ["l1", "s1", "w1"],
      ["l1", "s2", "w2"],
      ["l2", "s1", "w3"],
    ]);
  });
});

describe("generateRoster: one assignment per day", () => {
  it("never gives a worker two assignments on one day, over two lines", () => {
    const output = generateRoster(
      input({
        lines: [
          { id: "l1", positionId: "p1" },
          { id: "l2", positionId: "p1" },
        ],
        workers: [worker(1)],
        targets: [target(FIRST_DAY, "s1", 1, "l1"), target(FIRST_DAY, "s1", 1, "l2")],
      }),
    );

    expect(output.assignments.filter((a) => a.kind === "work")).toEqual([
      { lineId: "l1", workerId: "w1", date: FIRST_DAY, kind: "work", shiftId: "s1" },
    ]);
    expect(output.conflicts).toEqual([
      conflictOf(FIRST_DAY, "s1", 1, "Short by 1. 1 already assigned that day.", "l2"),
    ]);
  });
});

describe("generateRoster: working days per week", () => {
  it("gives a worker at most workDaysPerWeek work days, and conflicts for the rest", () => {
    const output = generateRoster(
      input({ workers: [worker(1)], targets: DAYS.map((d) => target(d, "s1", 1)) }),
    );

    expect(works(output)).toEqual(DAYS.slice(0, 5).map((d) => `${d}:w1:s1`));
    expect(output.conflicts).toEqual(
      DAYS.slice(5).map((d) => conflictOf(d, "s1", 1, "Short by 1. 1 at the weekly limit.")),
    );
  });

  it("lets a worker's own 7 days exceed a rule of 5, while a worker with 5 or null stops at 5", () => {
    const targets = DAYS.map((d) => target(d, "s1", 1));
    const seven = generateRoster(
      input({ workers: [worker(1, { workDaysPerWeek: 7 })], targets }),
    );
    const five = generateRoster(
      input({ workers: [worker(1, { workDaysPerWeek: 5 })], targets }),
    );
    const inherits = generateRoster(input({ workers: [worker(1)], targets }));

    expect(works(seven)).toEqual(DAYS.map((d) => `${d}:w1:s1`));
    expect(seven.conflicts).toEqual([]);
    expect(works(five)).toEqual(DAYS.slice(0, 5).map((d) => `${d}:w1:s1`));
    expect(works(inherits)).toEqual(works(five));
  });

  it("stops a worker with their own 3 days at 3, and the shortage names the weekly limit", () => {
    const output = generateRoster(
      input({
        workers: [worker(1, { workDaysPerWeek: 3 })],
        targets: DAYS.map((d) => target(d, "s1", 1)),
      }),
    );

    expect(works(output)).toEqual(DAYS.slice(0, 3).map((d) => `${d}:w1:s1`));
    expect(output.conflicts).toEqual(
      DAYS.slice(3).map((d) => conflictOf(d, "s1", 1, "Short by 1. 1 at the weekly limit.")),
    );
  });

  it("falls back to the rule for a worker with no own value, so a rule of 7 gives 7 days", () => {
    const output = generateRoster(
      input({
        workers: [worker(1)],
        rules: { ...RULES, workDaysPerWeek: 7 },
        targets: DAYS.map((d) => target(d, "s1", 1)),
      }),
    );

    expect(works(output)).toEqual(DAYS.map((d) => `${d}:w1:s1`));
  });

  it("stays deterministic with per-worker overrides", () => {
    const build = () =>
      input({
        workers: [worker(1, { workDaysPerWeek: 7 }), worker(2, { workDaysPerWeek: 3 }), worker(3)],
        targets: DAYS.map((d) => target(d, "s1", 2)),
      });

    expect(generateRoster(build())).toEqual(generateRoster(build()));
  });

  it("gives off rows for the other days of a worker who works, on the line of the first work", () => {
    const output = generateRoster(
      input({
        lines: [
          { id: "l1", positionId: "p1" },
          { id: "l2", positionId: "p1" },
        ],
        workers: [worker(1), worker(2)],
        targets: [target(DAYS[1], "s1", 1, "l2")],
      }),
    );

    const offs = output.assignments.filter((a) => a.kind === "off");

    expect(offs.map((a) => a.date)).toEqual(DAYS.filter((d) => d !== DAYS[1]));
    expect(offs.every((a) => a.workerId === "w1" && a.lineId === "l2" && a.shiftId === null)).toBe(
      true,
    );
  });

  it("gives no off row to a worker with no work assignment", () => {
    const output = generateRoster(input({ targets: [target(FIRST_DAY, "s1", 1)] }));

    expect(output.assignments.some((a) => a.workerId === "w2" || a.workerId === "w3")).toBe(false);
  });
});

describe("generateRoster: sharing the work", () => {
  it("prefers the worker with the fewest work days, and breaks ties by lower-case employee ID", () => {
    const output = generateRoster(
      input({
        workers: [worker(1, { employeeId: "emp-0002" }), worker(2, { employeeId: "EMP-0001" })],
        targets: [target(DAYS[0], "s1", 1), target(DAYS[1], "s1", 1)],
      }),
    );

    expect(works(output)).toEqual([`${DAYS[0]}:w2:s1`, `${DAYS[1]}:w1:s1`]);
  });
});

describe("generateRoster: moving to a lower shift", () => {
  it("blocks a move to a lower shift the next day before the exception days", () => {
    const output = generateRoster(
      input({
        workers: [worker(1)],
        targets: [target(DAYS[0], "s3", 1), target(DAYS[1], "s1", 1)],
      }),
    );

    expect(works(output)).toEqual([`${DAYS[0]}:w1:s3`]);
    expect(output.conflicts).toEqual([
      conflictOf(DAYS[1], "s1", 1, "Short by 1. 1 blocked from moving to a lower shift."),
    ]);
  });

  it("allows it once the worker has worked the exception days in a row", () => {
    const output = generateRoster(
      input({
        workers: [worker(1)],
        rules: { ...RULES, shiftExceptionDays: 1 },
        targets: [target(DAYS[0], "s3", 1), target(DAYS[1], "s1", 1)],
      }),
    );

    expect(works(output)).toEqual([`${DAYS[0]}:w1:s3`, `${DAYS[1]}:w1:s1`]);
  });

  it("always allows a move to a higher shift", () => {
    const output = generateRoster(
      input({
        workers: [worker(1)],
        targets: [target(DAYS[0], "s1", 1), target(DAYS[1], "s3", 1)],
      }),
    );

    expect(works(output)).toEqual([`${DAYS[0]}:w1:s1`, `${DAYS[1]}:w1:s3`]);
  });

  it("does not block a lower shift after a day off, because the chain is broken", () => {
    const output = generateRoster(
      input({
        workers: [worker(1)],
        targets: [target(DAYS[0], "s3", 1), target(DAYS[2], "s1", 1)],
      }),
    );

    expect(works(output)).toEqual([`${DAYS[0]}:w1:s3`, `${DAYS[2]}:w1:s1`]);
  });

  it("counts the history across the boundary of the roster", () => {
    const first = [target(FIRST_DAY, "s1", 1)];
    const blocked = generateRoster(
      input({
        workers: [worker(1)],
        targets: first,
        history: [
          noHistory("w1", { lastWorkDate: "2026-11-08", lastShiftOrder: 3, consecutiveWorkDays: 2 }),
        ],
      }),
    );
    const allowedByCount = generateRoster(
      input({
        workers: [worker(1)],
        targets: first,
        history: [
          noHistory("w1", { lastWorkDate: "2026-11-08", lastShiftOrder: 3, consecutiveWorkDays: 7 }),
        ],
      }),
    );
    const chainBroken = generateRoster(
      input({
        workers: [worker(1)],
        targets: first,
        history: [
          noHistory("w1", { lastWorkDate: "2026-11-07", lastShiftOrder: 3, consecutiveWorkDays: 2 }),
        ],
      }),
    );

    expect(works(blocked)).toEqual([]);
    expect(blocked.conflicts).toEqual([
      conflictOf(FIRST_DAY, "s1", 1, "Short by 1. 1 blocked from moving to a lower shift."),
    ]);
    expect(works(allowedByCount)).toEqual([`${FIRST_DAY}:w1:s1`]);
    expect(works(chainBroken)).toEqual([`${FIRST_DAY}:w1:s1`]);
  });
});

describe("generateRoster: the monthly limit", () => {
  it("counts the confirmed history of the month", () => {
    const output = generateRoster(
      input({
        workers: [worker(1)],
        rules: { ...RULES, maxWorkingDaysPerMonth: 3 },
        targets: DAYS.slice(0, 3).map((d) => target(d, "s1", 1)),
        history: [noHistory("w1", { monthWorkDays: { "2026-11": 2 } })],
      }),
    );

    expect(works(output)).toEqual([`${DAYS[0]}:w1:s1`]);
    expect(output.conflicts).toEqual([
      conflictOf(DAYS[1], "s1", 1, "Short by 1. 1 at the monthly limit."),
      conflictOf(DAYS[2], "s1", 1, "Short by 1. 1 at the monthly limit."),
    ]);
  });

  it("counts each calendar month separately when the roster crosses a month", () => {
    const days = requestDays("2026-11-28", "weekly");
    const output = generateRoster(
      input({
        days,
        workers: [worker(1)],
        rules: { ...RULES, maxWorkingDaysPerMonth: 3 },
        targets: days.map((d) => target(d, "s1", 1)),
      }),
    );

    expect(works(output)).toEqual([
      "2026-11-28:w1:s1",
      "2026-11-29:w1:s1",
      "2026-11-30:w1:s1",
      "2026-12-01:w1:s1",
      "2026-12-02:w1:s1",
    ]);
  });
});

describe("generateRoster: the contract end", () => {
  it("assigns up to and including the last day, and not after", () => {
    const output = generateRoster(
      input({
        workers: [worker(1, { endContract: "2026-11-11" })],
        targets: DAYS.slice(0, 4).map((d) => target(d, "s1", 1)),
      }),
    );

    expect(works(output)).toEqual(DAYS.slice(0, 3).map((d) => `${d}:w1:s1`));
    expect(output.conflicts).toEqual([
      conflictOf(DAYS[3], "s1", 1, "Short by 1. 1 with a contract ended."),
    ]);
  });

  it("gives no off row after the contract ended", () => {
    const output = generateRoster(
      input({
        workers: [worker(1, { endContract: "2026-11-11" })],
        targets: [target(DAYS[0], "s1", 1)],
      }),
    );

    expect(output.assignments.filter((a) => a.kind === "off").map((a) => a.date)).toEqual(
      DAYS.slice(1, 3),
    );
  });
});

describe("generateRoster: the position", () => {
  it("never picks a worker without the position when the match is required", () => {
    const output = generateRoster(
      input({ workers: [worker(1, { positionIds: ["p2"] })], targets: [target(FIRST_DAY, "s1", 1)] }),
    );

    expect(works(output)).toEqual([]);
    expect(output.conflicts).toEqual([
      conflictOf(FIRST_DAY, "s1", 1, "Short by 1. 1 without the position."),
    ]);
  });

  it("ignores the position when the match is not required", () => {
    const output = generateRoster(
      input({
        workers: [worker(1, { positionIds: ["p2"] })],
        rules: { ...RULES, requirePositionMatch: false },
        targets: [target(FIRST_DAY, "s1", 1)],
      }),
    );

    expect(works(output)).toEqual([`${FIRST_DAY}:w1:s1`]);
  });
});

describe("generateRoster: shortages", () => {
  it("records one conflict per line, day, and shift with the shortfall", () => {
    const output = generateRoster(
      input({ workers: [worker(1)], targets: [target(FIRST_DAY, "s1", 2)] }),
    );

    expect(output.conflicts).toEqual([
      {
        lineId: "l1",
        date: FIRST_DAY,
        shiftId: "s1",
        code: "shortage",
        shortfall: 1,
        message: "Short by 1. No worker is available for this line.",
      },
    ]);
  });

  it("lists every reason that rejected a worker, in priority order", () => {
    const output = generateRoster(
      input({
        workers: [
          worker(1, { positionIds: ["p2"] }),
          worker(2, { endContract: "2026-11-08" }),
        ],
        targets: [target(FIRST_DAY, "s1", 1)],
      }),
    );

    expect(output.conflicts).toEqual([
      conflictOf(FIRST_DAY, "s1", 1, "Short by 1. 1 without the position, 1 with a contract ended."),
    ]);
  });

  it("gives no conflicts and no assignments when there are no targets", () => {
    expect(generateRoster(input())).toEqual({ assignments: [], conflicts: [] });
  });
});
