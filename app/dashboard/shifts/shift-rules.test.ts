import { describe, expect, it } from "vitest";
import {
  bulkShiftDeleteMessage,
  bulkShiftRestoreMessage,
  canDeleteShift,
  canRestoreShift,
  formatShiftRange,
  shiftConflictField,
  SHIFT_IN_USE_MESSAGE,
  shiftFieldErrors,
  toHourMinute,
} from "./shift-rules";

const ORDER_INDEX = "shift_siteId_order_active_unique";
const NAME_INDEX = "shift_siteId_lowerName_active_unique";

describe("canDeleteShift", () => {
  const blocked = { ok: false, formError: "This shift is used by a pending or approved request" };

  it("allows deleting a shift no request uses", () => {
    expect(canDeleteShift({ requestStatuses: [] })).toEqual({ ok: true });
  });

  it("blocks a shift used by a pending request", () => {
    expect(canDeleteShift({ requestStatuses: ["pending"] })).toEqual(blocked);
    expect(SHIFT_IN_USE_MESSAGE).toBe(blocked.formError);
  });

  it("blocks a shift used by an approved request", () => {
    expect(canDeleteShift({ requestStatuses: ["approved"] })).toEqual(blocked);
  });

  it("allows a shift used only by rejected and cancelled requests", () => {
    expect(canDeleteShift({ requestStatuses: ["rejected", "cancelled"] })).toEqual({ ok: true });
  });

  it("blocks when one of several requests is pending", () => {
    expect(canDeleteShift({ requestStatuses: ["rejected", "pending", "cancelled"] })).toEqual(
      blocked,
    );
  });
});

describe("canRestoreShift", () => {
  it("blocks restoring a shift whose site is deleted", () => {
    expect(canRestoreShift({ siteDeleted: true })).toEqual({
      ok: false,
      formError: "Restore the site first",
    });
  });

  it("allows restoring a shift whose site is active", () => {
    expect(canRestoreShift({ siteDeleted: false })).toEqual({ ok: true });
  });
});

describe("shiftConflictField", () => {
  it("names the order when the order index is violated", () => {
    expect(shiftConflictField({ code: "23505", constraint: ORDER_INDEX })).toBe("order");
  });

  it("names the name when the name index is violated", () => {
    expect(shiftConflictField({ code: "23505", constraint: NAME_INDEX })).toBe("name");
  });

  it("finds the violation when the driver error sits on cause", () => {
    expect(
      shiftConflictField(new Error("insert failed", { cause: { code: "23505", constraint: ORDER_INDEX } })),
    ).toBe("order");
    expect(
      shiftConflictField(new Error("insert failed", { cause: { code: "23505", constraint: NAME_INDEX } })),
    ).toBe("name");
  });

  it("ignores a unique violation on another constraint", () => {
    expect(shiftConflictField({ code: "23505", constraint: "position_x" })).toBeNull();
  });

  it("ignores another error code on a shift constraint", () => {
    expect(shiftConflictField({ code: "23503", constraint: ORDER_INDEX })).toBeNull();
  });

  it("ignores values that are not errors", () => {
    expect(shiftConflictField(null)).toBeNull();
    expect(shiftConflictField("x")).toBeNull();
  });
});

describe("shiftFieldErrors", () => {
  it("keeps the first message per field", () => {
    expect(
      shiftFieldErrors([
        { path: ["name"], message: "first" },
        { path: ["name"], message: "second" },
        { path: ["endTime"], message: "end" },
      ]),
    ).toEqual({ name: "first", endTime: "end" });
  });

  it("returns nothing for no issues", () => {
    expect(shiftFieldErrors([])).toEqual({});
  });
});

describe("toHourMinute", () => {
  it("drops the seconds PostgreSQL returns", () => {
    expect(toHourMinute("22:00:00")).toBe("22:00");
  });

  it("leaves an HH:MM value alone", () => {
    expect(toHourMinute("06:00")).toBe("06:00");
  });
});

describe("formatShiftRange", () => {
  it("joins the start and end as one range", () => {
    expect(formatShiftRange("22:00:00", "06:00:00")).toBe("22:00 - 06:00");
  });
});

describe("bulkShiftDeleteMessage", () => {
  it("says how many shifts were deleted", () => {
    expect(bulkShiftDeleteMessage(1, 0)).toBe("1 shift deleted");
    expect(bulkShiftDeleteMessage(2, 0)).toBe("2 shifts deleted");
  });

  it("says when none could be deleted", () => {
    expect(bulkShiftDeleteMessage(0, 2)).toBe("2 shifts could not be deleted");
  });

  it("reports both counts when some were blocked", () => {
    expect(bulkShiftDeleteMessage(1, 1)).toBe("1 shift deleted, 1 shift could not be deleted");
  });
});

describe("bulkShiftRestoreMessage", () => {
  it("says how many shifts were restored", () => {
    expect(bulkShiftRestoreMessage(1, 0)).toBe("1 shift restored");
    expect(bulkShiftRestoreMessage(2, 0)).toBe("2 shifts restored");
  });

  it("says when none could be restored", () => {
    expect(bulkShiftRestoreMessage(0, 2)).toBe("2 shifts could not be restored");
  });

  it("reports both counts when some were blocked", () => {
    expect(bulkShiftRestoreMessage(2, 1)).toBe("2 shifts restored, 1 shift could not be restored");
  });
});
