import { describe, expect, it } from "vitest";
import type { BillableDay } from "@/types/billings";
import { formatBillingPeriod, groupBillableDays, isUniqueViolation } from "./billing-rules";

type Day = Omit<BillableDay, "attendanceId">;

function day(overrides: Partial<Day> & Pick<Day, "requestId" | "positionName">): Day {
  return {
    poNumber: overrides.requestId === "r-a" ? "PO-A" : "PO-B",
    departmentId: "d1",
    departmentName: "Production",
    subDepartmentId: null,
    subDepartmentName: null,
    positionId: `p-${overrides.positionName}`,
    ...overrides,
  };
}

describe("groupBillableDays", () => {
  it("groups days into PO blocks of lines with day counts and subtotals", () => {
    const days = [
      day({ requestId: "r-a", positionName: "Welder" }),
      day({ requestId: "r-b", positionName: "Welder" }),
      day({ requestId: "r-a", positionName: "Fitter" }),
      day({ requestId: "r-a", positionName: "Welder" }),
      day({ requestId: "r-b", positionName: "Welder" }),
      day({ requestId: "r-a", positionName: "Fitter" }),
      day({ requestId: "r-a", positionName: "Welder" }),
    ];

    const result = groupBillableDays(days);

    expect(result.totalDays).toBe(7);
    expect(result.pos).toHaveLength(2);
    expect(result.pos[0].poNumber).toBe("PO-A");
    expect(result.pos[0].subtotal).toBe(5);
    expect(result.pos[0].lines.map((line) => [line.positionName, line.days])).toEqual([
      ["Fitter", 2],
      ["Welder", 3],
    ]);
    expect(result.pos[1].poNumber).toBe("PO-B");
    expect(result.pos[1].subtotal).toBe(2);
    expect(result.pos[1].lines.map((line) => line.days)).toEqual([2]);
  });

  it("orders lines by department, then sub-department with null first, then position", () => {
    const result = groupBillableDays([
      day({ requestId: "r-a", positionName: "welder", departmentId: "d2", departmentName: "Yard" }),
      day({
        requestId: "r-a",
        positionName: "Welder",
        subDepartmentId: "s1",
        subDepartmentName: "Cutting",
      }),
      day({ requestId: "r-a", positionName: "fitter" }),
      day({ requestId: "r-a", positionName: "Welder" }),
    ]);

    expect(
      result.pos[0].lines.map((line) => [
        line.departmentName,
        line.subDepartmentName,
        line.positionName,
      ]),
    ).toEqual([
      ["Production", null, "fitter"],
      ["Production", null, "Welder"],
      ["Production", "Cutting", "Welder"],
      ["Yard", null, "welder"],
    ]);
  });

  it("returns no PO blocks and zero days for no rows", () => {
    expect(groupBillableDays([])).toEqual({ pos: [], totalDays: 0 });
  });

  it("keeps two rows that differ only in sub-department as two lines", () => {
    const result = groupBillableDays([
      day({ requestId: "r-a", positionName: "Welder" }),
      day({
        requestId: "r-a",
        positionName: "Welder",
        subDepartmentId: "s1",
        subDepartmentName: "Cutting",
      }),
    ]);

    expect(result.pos[0].lines).toHaveLength(2);
    expect(result.pos[0].subtotal).toBe(2);
  });
});

describe("formatBillingPeriod", () => {
  it("writes a range with fixed English month names", () => {
    expect(formatBillingPeriod("2026-11-01", "2026-11-30")).toBe("1 Nov 2026 to 30 Nov 2026");
  });

  it("writes one date when the period is a single day", () => {
    expect(formatBillingPeriod("2026-11-09", "2026-11-09")).toBe("9 Nov 2026");
  });
});

describe("isUniqueViolation", () => {
  it("is true for a unique violation code, directly or on cause", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
  });

  it("is false for other errors and non-objects", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});
