import { describe, expect, it } from "vitest";
import { subDepartmentSchema } from "./sub-department";

const messages = (name: string) => {
  const result = subDepartmentSchema.safeParse({ name });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("subDepartmentSchema", () => {
  it("rejects an empty name", () => {
    expect(messages("")).toEqual(["Sub-department name is required"]);
  });

  it("rejects a name made only of spaces", () => {
    expect(messages("   ")).toEqual(["Sub-department name is required"]);
  });

  it("trims surrounding spaces", () => {
    expect(subDepartmentSchema.parse({ name: "  Packing  " }).name).toBe("Packing");
  });

  it("accepts exactly 100 characters", () => {
    expect(messages("a".repeat(100))).toEqual([]);
  });

  it("rejects 101 characters", () => {
    expect(messages("a".repeat(101))).toEqual([
      "Sub-department name must be 100 characters or fewer",
    ]);
  });
});
