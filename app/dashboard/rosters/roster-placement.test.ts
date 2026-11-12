import { describe, expect, it } from "vitest";
import { placementTier } from "./roster-placement";

const line = (departmentId: string, subDepartmentId: string | null = null) => ({
  departmentId,
  subDepartmentId,
});

describe("placementTier", () => {
  it("is 2 for the same department and the same sub-department", () => {
    expect(placementTier(line("dA", "sA"), line("dA", "sA"))).toBe(2);
  });

  it("is 2 when neither side has a sub-department", () => {
    expect(placementTier(line("dA"), line("dA"))).toBe(2);
  });

  it("is 1 for the same department and a different sub-department", () => {
    expect(placementTier(line("dA", "sB"), line("dA", "sA"))).toBe(1);
  });

  it("is 1 when only one side has a sub-department", () => {
    expect(placementTier(line("dA"), line("dA", "sA"))).toBe(1);
    expect(placementTier(line("dA", "sA"), line("dA"))).toBe(1);
  });

  it("is 0 for a different department, even with the same sub-department id", () => {
    expect(placementTier(line("dB", "sA"), line("dA", "sA"))).toBe(0);
  });

  it("is 0 with no previous placement", () => {
    expect(placementTier(null, line("dA"))).toBe(0);
  });
});
