import { describe, expect, it } from "vitest";
import { parseWorkerHistoryParams } from "./worker-history";

const TODAY = "2026-11-12";
const ID = "11111111-1111-4111-8111-111111111111";

describe("parseWorkerHistoryParams", () => {
  it("gives the defaults for an empty URL", () => {
    expect(parseWorkerHistoryParams({}, TODAY)).toEqual({
      month: "2026-11",
      departmentId: null,
      shiftId: null,
      type: "all",
      attendance: "all",
    });
  });

  it("keeps a valid past month", () => {
    expect(parseWorkerHistoryParams({ month: "2026-10" }, TODAY).month).toBe("2026-10");
  });

  it.each(["2026-13", "2026-1", "abc", "2099-01", "", "0000-01", "0001-06", "1999-12"])(
    "turns the month %j into the current month",
    (month) => {
      expect(parseWorkerHistoryParams({ month }, TODAY).month).toBe("2026-11");
    },
  );

  it("reads the first value of a repeated month", () => {
    expect(parseWorkerHistoryParams({ month: ["2026-10", "2026-09"] }, TODAY).month).toBe(
      "2026-10",
    );
  });

  it("keeps a uuid for department and shift and drops anything else", () => {
    const kept = parseWorkerHistoryParams({ department: ID, shift: ID }, TODAY);
    const dropped = parseWorkerHistoryParams({ department: "x", shift: "y" }, TODAY);

    expect([kept.departmentId, kept.shiftId]).toEqual([ID, ID]);
    expect([dropped.departmentId, dropped.shiftId]).toEqual([null, null]);
  });

  it("keeps a known type and falls back to all", () => {
    expect(parseWorkerHistoryParams({ type: "off" }, TODAY).type).toBe("off");
    expect(parseWorkerHistoryParams({ type: "rest" }, TODAY).type).toBe("all");
  });

  it("keeps a known attendance and falls back to all", () => {
    expect(parseWorkerHistoryParams({ attendance: "not-marked" }, TODAY).attendance).toBe(
      "not-marked",
    );
    expect(parseWorkerHistoryParams({ attendance: "sick" }, TODAY).attendance).toBe("sick");
    expect(parseWorkerHistoryParams({ attendance: "late" }, TODAY).attendance).toBe("all");
  });
});
