import { describe, expect, it } from "vitest";

import type { EngineHistory, EngineRules } from "@/types/rosters";

import {
  NEEDS_ABSENT_MESSAGE,
  SUBSTITUTE_COVERS_MESSAGE,
  SUBSTITUTE_MESSAGES,
  checkSubstitute,
  type SubstituteCheckInput,
} from "./attendance-substitute-rules";

const RULES: EngineRules = {
  workDaysPerWeek: 5,
  shiftExceptionDays: 7,
  requirePositionMatch: true,
  keepPreviousPlacement: false,
  maxWorkingDaysPerMonth: 26,
};

const NO_HISTORY: EngineHistory = {
  workerId: "w9",
  lastWorkDate: null,
  lastShiftOrder: null,
  consecutiveWorkDays: 0,
  monthWorkDays: {},
  lastPlacement: null,
};

const input = (overrides: Partial<SubstituteCheckInput> = {}): SubstituteCheckInput => ({
  date: "2026-11-10",
  absentWorkerId: "w1",
  absentShiftOrder: 1,
  position: { id: "p1", name: "Operator Produksi" },
  rules: RULES,
  candidate: {
    id: "w9",
    endContract: "2027-01-01",
    positionIds: ["p1"],
    deleted: false,
    locationId: "l1",
  },
  locationId: "l1",
  workDatesToday: false,
  alreadyCovering: false,
  history: NO_HISTORY,
  ...overrides,
});

const candidate = (overrides: Partial<SubstituteCheckInput["candidate"]>) => ({
  ...input().candidate,
  ...overrides,
});

describe("messages", () => {
  it("has the exact texts", () => {
    expect(NEEDS_ABSENT_MESSAGE).toBe("Mark the worker Absent and save first.");
    expect(SUBSTITUTE_COVERS_MESSAGE).toBe("This worker already covers someone else that day.");
    expect(SUBSTITUTE_MESSAGES.deleted).toBe("This worker is no longer active.");
    expect(SUBSTITUTE_MESSAGES.otherLocation).toBe("This worker belongs to another location.");
    expect(SUBSTITUTE_MESSAGES.sameWorker).toBe("The absent worker cannot cover themself.");
    expect(SUBSTITUTE_MESSAGES.contractEnded("2026-11-09")).toBe("Contract ended 2026-11-09.");
    expect(SUBSTITUTE_MESSAGES.alreadyWorking).toBe("Already assigned to work on this day.");
    expect(SUBSTITUTE_MESSAGES.alreadyCovering).toBe("Already covers another worker on this day.");
  });
});

describe("checkSubstitute", () => {
  it("accepts an off-day worker of the same location with no warning", () => {
    expect(checkSubstitute(input())).toEqual({ hard: [], warnings: [] });
  });

  it("blocks a deleted worker", () => {
    expect(checkSubstitute(input({ candidate: candidate({ deleted: true }) })).hard).toEqual([
      "This worker is no longer active.",
    ]);
  });

  it("blocks a worker of another location", () => {
    expect(checkSubstitute(input({ candidate: candidate({ locationId: "l2" }) })).hard).toEqual([
      "This worker belongs to another location.",
    ]);
  });

  it("blocks the absent worker", () => {
    expect(checkSubstitute(input({ candidate: candidate({ id: "w1" }) })).hard).toEqual([
      "The absent worker cannot cover themself.",
    ]);
  });

  it("blocks a worker whose contract ended before the date", () => {
    expect(
      checkSubstitute(input({ candidate: candidate({ endContract: "2026-11-09" }) })).hard,
    ).toEqual(["Contract ended 2026-11-09."]);
  });

  it("accepts a worker whose contract ends on the date", () => {
    expect(checkSubstitute(input({ candidate: candidate({ endContract: "2026-11-10" }) }))).toEqual({
      hard: [],
      warnings: [],
    });
  });

  it("blocks a worker who works that date", () => {
    expect(checkSubstitute(input({ workDatesToday: true })).hard).toEqual([
      "Already assigned to work on this day.",
    ]);
  });

  it("blocks a worker already covering someone that date", () => {
    expect(checkSubstitute(input({ alreadyCovering: true })).hard).toEqual([
      "Already covers another worker on this day.",
    ]);
  });

  it("lists every hard block in the fixed order", () => {
    const result = checkSubstitute(
      input({
        candidate: candidate({
          id: "w1",
          deleted: true,
          locationId: "l2",
          endContract: "2026-11-01",
        }),
        workDatesToday: true,
        alreadyCovering: true,
      }),
    );

    expect(result.hard).toEqual([
      "This worker is no longer active.",
      "This worker belongs to another location.",
      "The absent worker cannot cover themself.",
      "Contract ended 2026-11-01.",
      "Already assigned to work on this day.",
      "Already covers another worker on this day.",
    ]);
  });

  it("does not warn about the contract, which is a hard block here", () => {
    expect(
      checkSubstitute(input({ candidate: candidate({ endContract: "2026-11-09" }) })).warnings,
    ).toEqual([]);
  });

  it("warns about a missing position when the match is required", () => {
    expect(
      checkSubstitute(input({ candidate: candidate({ positionIds: ["p2"] }) })).warnings,
    ).toEqual(["Does not have the position Operator Produksi."]);
  });

  it("does not warn about the position when the match is not required", () => {
    expect(
      checkSubstitute(
        input({
          candidate: candidate({ positionIds: ["p2"] }),
          rules: { ...RULES, requirePositionMatch: false },
        }),
      ).warnings,
    ).toEqual([]);
  });

  it("warns about a move to a lower shift", () => {
    const history: EngineHistory = {
      ...NO_HISTORY,
      lastWorkDate: "2026-11-09",
      lastShiftOrder: 3,
      consecutiveWorkDays: 2,
    };

    expect(checkSubstitute(input({ history })).warnings).toEqual([
      "Moves from shift 3 to shift 1 on Tue 10 Nov, before 7 working days.",
    ]);
  });

  it("warns when the month would go over the limit", () => {
    const history = { ...NO_HISTORY, monthWorkDays: { "2026-11": 26 } };

    expect(checkSubstitute(input({ history })).warnings).toEqual([
      "Would exceed 26 working days in November.",
    ]);
  });

  it("keeps the warnings next to the hard blocks", () => {
    const result = checkSubstitute(
      input({ workDatesToday: true, candidate: candidate({ positionIds: [] }) }),
    );

    expect(result.hard).toEqual(["Already assigned to work on this day."]);
    expect(result.warnings).toEqual(["Does not have the position Operator Produksi."]);
  });
});
