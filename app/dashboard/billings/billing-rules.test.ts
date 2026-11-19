import { describe, expect, it } from "vitest";
import type { BillableDay } from "@/types/billings";
import {
  billingFormErrors,
  billingLocationChoices,
  formatBillingIssuedAt,
  formatBillingPeriod,
  groupBillableDays,
  isClaimCollision,
  isNumberCollision,
} from "./billing-rules";

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

describe("formatBillingIssuedAt", () => {
  it("writes the date in Jakarta time, not UTC", () => {
    expect(formatBillingIssuedAt("2026-11-18T18:30:00.000Z")).toBe("19 Nov 2026");
  });

  it("writes a dash when the billing was never issued", () => {
    expect(formatBillingIssuedAt(null)).toBe("-");
  });
});

describe("isClaimCollision", () => {
  it("is true for a unique violation on the billed-day key, directly or on cause", () => {
    expect(isClaimCollision({ code: "23505", constraint: "billing_attendance_pkey" })).toBe(true);
    expect(
      isClaimCollision({ cause: { code: "23505", constraint: "billing_attendance_pkey" } }),
    ).toBe(true);
  });

  it("is false for a unique violation on another constraint or with none", () => {
    expect(isClaimCollision({ code: "23505", constraint: "billing_number_unique" })).toBe(false);
    expect(isClaimCollision({ code: "23505" })).toBe(false);
  });

  it("is false for other errors and non-objects", () => {
    expect(isClaimCollision({ code: "23503", constraint: "billing_attendance_pkey" })).toBe(false);
    expect(isClaimCollision(new Error("x"))).toBe(false);
    expect(isClaimCollision(null)).toBe(false);
    expect(isClaimCollision("23505")).toBe(false);
  });
});

describe("isNumberCollision", () => {
  it("is true for a unique violation on the billing number, directly or on cause", () => {
    expect(isNumberCollision({ code: "23505", constraint: "billing_number_unique" })).toBe(true);
    expect(
      isNumberCollision({ cause: { code: "23505", constraint: "billing_number_unique" } }),
    ).toBe(true);
  });

  it("is false for another constraint, no constraint, or another code", () => {
    expect(isNumberCollision({ code: "23505", constraint: "billing_attendance_pkey" })).toBe(false);
    expect(isNumberCollision({ code: "23505" })).toBe(false);
    expect(isNumberCollision({ code: "23503", constraint: "billing_number_unique" })).toBe(false);
    expect(isNumberCollision(null)).toBe(false);
  });
});

describe("billingFormErrors", () => {
  it("keeps the first message for each field", () => {
    expect(
      billingFormErrors([
        { path: ["locationId"], message: "Choose a location" },
        { path: ["period"], message: "Choose a valid period" },
        { path: ["period", "from"], message: "Other" },
      ]),
    ).toEqual({ locationId: "Choose a location", period: "Choose a valid period" });
  });

  it("returns nothing for no issues", () => {
    expect(billingFormErrors([])).toEqual({});
  });
});

describe("billingLocationChoices", () => {
  const sites = [
    { id: "s1", name: "Site A" },
    { id: "s2", name: "Site B" },
  ];
  const locations = [
    { id: "l1", name: "Plant 1", siteId: "s1" },
    { id: "l2", name: "Plant 2", siteId: "s2" },
  ];

  it("names the site when locations come from several sites", () => {
    expect(billingLocationChoices(sites, locations)).toEqual([
      { id: "l1", name: "Plant 1", siteName: "Site A" },
      { id: "l2", name: "Plant 2", siteName: "Site B" },
    ]);
  });

  it("leaves the site out when there is one site", () => {
    expect(billingLocationChoices([sites[0]], [locations[0]])).toEqual([
      { id: "l1", name: "Plant 1", siteName: null },
    ]);
  });
});
