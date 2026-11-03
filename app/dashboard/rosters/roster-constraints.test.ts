import { describe, expect, it } from "vitest";

import {
  REJECTION_PHRASES,
  contractEnded,
  monthlyLimitReached,
  shiftMoveBlocked,
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
