import { describe, expect, it } from "vitest";
import {
  bulkPositionDeleteMessage,
  bulkPositionRestoreMessage,
  canDeletePosition,
  canRestorePosition,
  isPositionNameConflict,
} from "./position-rules";

const POSITION_INDEX = "position_siteId_lowerName_active_unique";

describe("canRestorePosition", () => {
  it("blocks restoring a position whose site is deleted", () => {
    expect(canRestorePosition({ siteDeleted: true })).toEqual({
      ok: false,
      formError: "Restore the site first",
    });
  });

  it("allows restoring a position whose site is active", () => {
    expect(canRestorePosition({ siteDeleted: false })).toEqual({ ok: true });
  });
});

describe("isPositionNameConflict", () => {
  it("detects the active-name unique violation", () => {
    expect(isPositionNameConflict({ code: "23505", constraint: POSITION_INDEX })).toBe(true);
  });

  it("detects the violation when the driver error sits on cause", () => {
    expect(
      isPositionNameConflict(
        new Error("insert failed", { cause: { code: "23505", constraint: POSITION_INDEX } }),
      ),
    ).toBe(true);
  });

  it("ignores a unique violation on another constraint", () => {
    expect(isPositionNameConflict({ code: "23505", constraint: "department_x" })).toBe(false);
  });

  it("ignores another error code on the same constraint", () => {
    expect(isPositionNameConflict({ code: "23503", constraint: POSITION_INDEX })).toBe(false);
  });

  it("ignores null and strings", () => {
    expect(isPositionNameConflict(null)).toBe(false);
    expect(isPositionNameConflict("boom")).toBe(false);
  });
});

describe("bulkPositionDeleteMessage", () => {
  it("reports several deleted positions", () => {
    expect(bulkPositionDeleteMessage(2, 0)).toBe("2 positions deleted");
  });

  it("reports one deleted position in the singular", () => {
    expect(bulkPositionDeleteMessage(1, 0)).toBe("1 position deleted");
  });

  it("reports positions that could not be deleted", () => {
    expect(bulkPositionDeleteMessage(0, 2)).toBe("2 positions could not be deleted");
  });

  it("reports both outcomes when some positions were blocked", () => {
    expect(bulkPositionDeleteMessage(1, 1)).toBe("1 position deleted, 1 could not be deleted");
  });
});

describe("bulkPositionRestoreMessage", () => {
  it("reports several restored positions", () => {
    expect(bulkPositionRestoreMessage(2, 0)).toBe("2 positions restored");
  });

  it("reports one restored position in the singular", () => {
    expect(bulkPositionRestoreMessage(1, 0)).toBe("1 position restored");
  });

  it("reports positions that could not be restored", () => {
    expect(bulkPositionRestoreMessage(0, 2)).toBe("2 positions could not be restored");
  });

  it("reports both outcomes when some positions were blocked", () => {
    expect(bulkPositionRestoreMessage(1, 1)).toBe("1 position restored, 1 could not be restored");
  });
});

describe("canDeletePosition", () => {
  it("allows deleting a position no active worker has", () => {
    expect(canDeletePosition({ activeWorkers: 0 })).toEqual({ ok: true });
  });

  it("blocks deleting a position one active worker has", () => {
    expect(canDeletePosition({ activeWorkers: 1 })).toEqual({
      ok: false,
      formError: "This position is assigned to 1 active worker. Remove it from them first.",
    });
  });

  it("uses the plural for several workers", () => {
    expect(canDeletePosition({ activeWorkers: 4 })).toEqual({
      ok: false,
      formError: "This position is assigned to 4 active workers. Remove it from them first.",
    });
  });
});
