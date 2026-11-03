import { describe, expect, it } from "vitest";

import type { EngineHistory, EngineRules, ReplacementInput } from "@/types/rosters";

import { checkReplacement, checkReplacementDetailed } from "./roster-replacement";
import { requestDays } from "./roster-rules";

const DAYS = requestDays("2026-11-09", "weekly");
const RULES: EngineRules = {
  workDaysPerWeek: 5,
  shiftExceptionDays: 7,
  requirePositionMatch: true,
  maxWorkingDaysPerMonth: 26,
};
const NO_HISTORY: EngineHistory = {
  workerId: "w9",
  lastWorkDate: null,
  lastShiftOrder: null,
  consecutiveWorkDays: 0,
  monthWorkDays: {},
};

// A row of seven days: the given shift orders for the first days, off for the rest.
function row(...orders: (number | "off")[]): ReplacementInput["row"] {
  return DAYS.map((date, index) => {
    const order = orders[index] ?? "off";

    return order === "off"
      ? { date, kind: "off" as const, shiftOrder: null }
      : { date, kind: "work" as const, shiftOrder: order };
  });
}

const input = (overrides: Partial<ReplacementInput> = {}): ReplacementInput => ({
  row: row(1, 1, 1, 1, 1),
  candidate: { id: "w9", endContract: "2027-01-01", positionIds: ["p1"] },
  position: { id: "p1", name: "Operator Produksi" },
  alreadyInRoster: false,
  otherRosterWorkDates: [],
  history: NO_HISTORY,
  rules: RULES,
  ...overrides,
});

describe("checkReplacement", () => {
  it("accepts a candidate who breaks no rule", () => {
    expect(checkReplacement(input())).toEqual({ ok: true });
  });

  it("refuses a worker already in this roster", () => {
    expect(checkReplacement(input({ alreadyInRoster: true }))).toEqual({
      ok: false,
      reasons: ["Already in this roster."],
    });
  });

  it("refuses a candidate without the position when the match is required", () => {
    expect(
      checkReplacement(
        input({ candidate: { id: "w9", endContract: "2027-01-01", positionIds: ["p2"] } }),
      ),
    ).toEqual({ ok: false, reasons: ["Does not have the position Operator Produksi."] });
  });

  it("ignores the position when the match is not required", () => {
    expect(
      checkReplacement(
        input({
          candidate: { id: "w9", endContract: "2027-01-01", positionIds: ["p2"] },
          rules: { ...RULES, requirePositionMatch: false },
        }),
      ),
    ).toEqual({ ok: true });
  });

  it("gives the contract reason once when work days fall after the contract ends", () => {
    expect(
      checkReplacement(
        input({ candidate: { id: "w9", endContract: "2026-11-11", positionIds: ["p1"] } }),
      ),
    ).toEqual({ ok: false, reasons: ["Contract ends 2026-11-11."] });
  });

  it("gives no contract reason for off days after the contract ends", () => {
    expect(
      checkReplacement(
        input({
          row: row(1, 1, 1),
          candidate: { id: "w9", endContract: "2026-11-11", positionIds: ["p1"] },
        }),
      ),
    ).toEqual({ ok: true });
  });

  it("gives one reason for each work day that is in another roster", () => {
    expect(
      checkReplacement(input({ otherRosterWorkDates: ["2026-11-10", "2026-11-12"] })),
    ).toEqual({
      ok: false,
      reasons: [
        "Assigned to another roster on Tue 10 Nov.",
        "Assigned to another roster on Thu 12 Nov.",
      ],
    });
  });

  it("ignores another roster on a day that is off in this row", () => {
    expect(checkReplacement(input({ otherRosterWorkDates: ["2026-11-14"] }))).toEqual({ ok: true });
  });

  it("refuses a move to a lower shift before the exception days, and names the day", () => {
    expect(checkReplacement(input({ row: row(3, 1) }))).toEqual({
      ok: false,
      reasons: ["Moves from shift 3 to shift 1 on Tue 10 Nov, before 7 working days."],
    });
  });

  it("accepts the same move once the exception days are reached", () => {
    expect(
      checkReplacement(input({ row: row(3, 1), rules: { ...RULES, shiftExceptionDays: 1 } })),
    ).toEqual({ ok: true });
  });

  it("accepts a move to a higher shift", () => {
    expect(checkReplacement(input({ row: row(1, 3) }))).toEqual({ ok: true });
  });

  it("counts the candidate's history on the first day of the row", () => {
    const history: EngineHistory = {
      ...NO_HISTORY,
      lastWorkDate: "2026-11-08",
      lastShiftOrder: 3,
      consecutiveWorkDays: 2,
    };

    expect(checkReplacement(input({ row: row(1), history }))).toEqual({
      ok: false,
      reasons: ["Moves from shift 3 to shift 1 on Mon 9 Nov, before 7 working days."],
    });
    expect(
      checkReplacement(input({ row: row(1), history: { ...history, lastWorkDate: "2026-11-07" } })),
    ).toEqual({ ok: true });
  });

  it("refuses when the month would go over the limit, once per month", () => {
    const history = { ...NO_HISTORY, monthWorkDays: { "2026-11": 23 } };

    expect(checkReplacement(input({ row: row(1, 1, 1, 1), history }))).toEqual({
      ok: false,
      reasons: ["Would exceed 26 working days in November."],
    });
  });

  it("accepts a month that ends exactly at the limit", () => {
    const history = { ...NO_HISTORY, monthWorkDays: { "2026-11": 22 } };

    expect(checkReplacement(input({ row: row(1, 1, 1, 1), history }))).toEqual({ ok: true });
  });

  it("gives every reason, in the documented order", () => {
    const result = checkReplacement(
      input({
        row: row(3, 1, 1, 1),
        alreadyInRoster: true,
        candidate: { id: "w9", endContract: "2026-11-10", positionIds: ["p2"] },
        otherRosterWorkDates: ["2026-11-09"],
        history: { ...NO_HISTORY, monthWorkDays: { "2026-11": 24 } },
      }),
    );

    expect(result).toEqual({
      ok: false,
      reasons: [
        "Already in this roster.",
        "Does not have the position Operator Produksi.",
        "Contract ends 2026-11-10.",
        "Assigned to another roster on Mon 9 Nov.",
        "Moves from shift 3 to shift 1 on Tue 10 Nov, before 7 working days.",
        "Would exceed 26 working days in November.",
      ],
    });
  });
});

describe("checkReplacementDetailed", () => {
  it("gives two empty lists for a clean candidate", () => {
    expect(checkReplacementDetailed(input())).toEqual({ hard: [], warnings: [] });
  });

  it("splits every reason into hard and warnings, each in the documented order", () => {
    const result = checkReplacementDetailed(
      input({
        row: row(3, 1, 1, 1),
        alreadyInRoster: true,
        candidate: { id: "w9", endContract: "2026-11-10", positionIds: ["p2"] },
        otherRosterWorkDates: ["2026-11-09"],
        history: { ...NO_HISTORY, monthWorkDays: { "2026-11": 24 } },
      }),
    );

    expect(result).toEqual({
      hard: ["Already in this roster.", "Assigned to another roster on Mon 9 Nov."],
      warnings: [
        "Does not have the position Operator Produksi.",
        "Contract ends 2026-11-10.",
        "Moves from shift 3 to shift 1 on Tue 10 Nov, before 7 working days.",
        "Would exceed 26 working days in November.",
      ],
    });
  });
});
