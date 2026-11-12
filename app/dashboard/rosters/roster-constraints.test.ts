import { describe, expect, it } from "vitest";

import type { EngineHistory } from "@/types/rosters";

import {
  REJECTION_PHRASES,
  contractEnded,
  monthlyLimitReached,
  monthlyMessage,
  monthlyOverrunEvents,
  shiftMoveBlocked,
  shiftMoveEvents,
  shiftMoveMessage,
  shortageMessage,
} from "./roster-constraints";

describe("contractEnded", () => {
  it("is false on the last day of the contract and true the day after", () => {
    expect(contractEnded({ endContract: "2026-11-11" }, "2026-11-11")).toBe(false);
    expect(contractEnded({ endContract: "2026-11-11" }, "2026-11-12")).toBe(true);
  });

  it("is false before the end", () => {
    expect(contractEnded({ endContract: "2026-11-11" }, "2026-11-09")).toBe(false);
  });
});

describe("shiftMoveBlocked", () => {
  it("blocks a move to a lower shift before the exception", () => {
    expect(shiftMoveBlocked(3, 1, 2, 7)).toBe(true);
  });

  it("allows a move to a lower shift once the exception days are reached", () => {
    expect(shiftMoveBlocked(3, 1, 7, 7)).toBe(false);
    expect(shiftMoveBlocked(3, 1, 8, 7)).toBe(false);
  });

  it("allows a move to a higher or the same shift", () => {
    expect(shiftMoveBlocked(1, 3, 0, 7)).toBe(false);
    expect(shiftMoveBlocked(2, 2, 0, 7)).toBe(false);
  });

  it("allows any shift when there is no previous shift", () => {
    expect(shiftMoveBlocked(null, 1, 0, 7)).toBe(false);
  });
});

describe("monthlyLimitReached", () => {
  it("is true at the limit and false below it", () => {
    expect(monthlyLimitReached(26, 26)).toBe(true);
    expect(monthlyLimitReached(27, 26)).toBe(true);
    expect(monthlyLimitReached(25, 26)).toBe(false);
  });
});

describe("REJECTION_PHRASES", () => {
  it("lists the six reasons in priority order", () => {
    expect(Object.keys(REJECTION_PHRASES)).toEqual([
      "position",
      "contract",
      "assigned",
      "weekly",
      "shiftMove",
      "monthly",
    ]);
  });
});

describe("shortageMessage", () => {
  it("says no worker is available when nothing was rejected", () => {
    expect(shortageMessage(1, {})).toBe("Short by 1. No worker is available for this line.");
  });

  it("lists only the reasons that happened", () => {
    expect(shortageMessage(2, { assigned: 3, monthly: 1 })).toBe(
      "Short by 2. 3 already assigned that day, 1 at the monthly limit.",
    );
  });

  it("lists the reasons in priority order, whatever the order of the keys", () => {
    expect(shortageMessage(1, { shiftMove: 1, contract: 1, position: 2 })).toBe(
      "Short by 1. 2 without the position, 1 with a contract ended, 1 blocked from moving to a lower shift.",
    );
  });

  it("skips a reason with a count of zero", () => {
    expect(shortageMessage(1, { position: 0, weekly: 2 })).toBe(
      "Short by 1. 2 at the weekly limit.",
    );
  });
});

const NO_HISTORY: EngineHistory = {
  workerId: "w1",
  lastWorkDate: null,
  lastShiftOrder: null,
  consecutiveWorkDays: 0,
  monthWorkDays: {},
lastPlacement: null,
};

const cell = (date: string, shiftOrder: number | null) => ({ date, shiftOrder });

describe("shiftMoveEvents", () => {
  it("returns a move to a lower shift on consecutive days", () => {
    expect(
      shiftMoveEvents([cell("2026-11-09", 3), cell("2026-11-10", 1)], NO_HISTORY, "2026-11-09", 7),
    ).toEqual([{ index: 1, date: "2026-11-10", previousOrder: 3, order: 1, run: 1 }]);
  });

  it("returns nothing for a move to a higher shift", () => {
    expect(
      shiftMoveEvents([cell("2026-11-09", 1), cell("2026-11-10", 3)], NO_HISTORY, "2026-11-09", 7),
    ).toEqual([]);
  });

  it("breaks the chain on a gap day", () => {
    expect(
      shiftMoveEvents([cell("2026-11-09", 3), cell("2026-11-11", 1)], NO_HISTORY, "2026-11-09", 7),
    ).toEqual([]);
  });

  it("starts from the history only when it ends the day before the first day", () => {
    const history = {
      ...NO_HISTORY,
      lastWorkDate: "2026-11-08",
      lastShiftOrder: 3,
      consecutiveWorkDays: 2,
    };

    expect(shiftMoveEvents([cell("2026-11-09", 1)], history, "2026-11-09", 7)).toEqual([
      { index: 0, date: "2026-11-09", previousOrder: 3, order: 1, run: 2 },
    ]);
    expect(
      shiftMoveEvents(
        [cell("2026-11-09", 1)],
        { ...history, lastWorkDate: "2026-11-07" },
        "2026-11-09",
        7,
      ),
    ).toEqual([]);
    expect(shiftMoveEvents([cell("2026-11-09", 1)], undefined, "2026-11-09", 7)).toEqual([]);
  });

  it("is lifted once the exception days are worked in a row", () => {
    const cells = [cell("2026-11-09", 3), cell("2026-11-10", 3), cell("2026-11-11", 1)];

    expect(shiftMoveEvents(cells, NO_HISTORY, "2026-11-09", 3)).toHaveLength(1);
    expect(shiftMoveEvents(cells, NO_HISTORY, "2026-11-09", 2)).toEqual([]);
  });

  it("words the move with the day and the exception days", () => {
    expect(
      shiftMoveMessage({ index: 1, date: "2026-11-10", previousOrder: 3, order: 1, run: 1 }, 7),
    ).toBe("Moves from shift 3 to shift 1 on Tue 10 Nov, before 7 working days.");
  });
});

describe("monthlyOverrunEvents", () => {
  const days = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"].map((date) =>
    cell(date, 1),
  );

  it("returns the first cell past the limit, once per month", () => {
    const history = { ...NO_HISTORY, monthWorkDays: { "2026-11": 23 } };

    expect(monthlyOverrunEvents(days, history, 26)).toEqual([
      { index: 3, date: "2026-11-12", month: "2026-11" },
    ]);
  });

  it("returns nothing when the month ends exactly at the limit", () => {
    const history = { ...NO_HISTORY, monthWorkDays: { "2026-11": 22 } };

    expect(monthlyOverrunEvents(days, history, 26)).toEqual([]);
  });

  it("counts each month on its own and works without history", () => {
    const cells = [cell("2026-11-30", 1), cell("2026-12-01", 1), cell("2026-12-02", 1)];

    expect(monthlyOverrunEvents(cells, undefined, 1)).toEqual([
      { index: 2, date: "2026-12-02", month: "2026-12" },
    ]);
    expect(
      monthlyOverrunEvents(cells, { ...NO_HISTORY, monthWorkDays: { "2026-11": 1 } }, 1),
    ).toEqual([
      { index: 0, date: "2026-11-30", month: "2026-11" },
      { index: 2, date: "2026-12-02", month: "2026-12" },
    ]);
  });

  it("words the overrun with the limit and the month", () => {
    expect(monthlyMessage({ index: 3, date: "2026-11-12", month: "2026-11" }, 26)).toBe(
      "Would exceed 26 working days in November.",
    );
  });
});
