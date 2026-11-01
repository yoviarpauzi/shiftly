import { describe, expect, it } from "vitest";
import { departmentNameSchema, departmentSchema } from "./department";

const LOCATION_ID = "11111111-1111-4111-8111-111111111111";

const messages = (input: { name: string; locationId?: string }) => {
  const result = departmentSchema.safeParse({ locationId: LOCATION_ID, ...input });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("departmentSchema", () => {
  it("rejects an empty name", () => {
    expect(messages({ name: "" })).toEqual(["Department name is required"]);
  });

  it("rejects a name made only of spaces", () => {
    expect(messages({ name: "   " })).toEqual(["Department name is required"]);
  });

  it("trims surrounding spaces", () => {
    expect(
      departmentSchema.parse({ name: "  Produksi  ", locationId: LOCATION_ID }).name,
    ).toBe("Produksi");
  });

  it("accepts exactly 100 characters", () => {
    expect(messages({ name: "a".repeat(100) })).toEqual([]);
  });

  it("rejects 101 characters", () => {
    expect(messages({ name: "a".repeat(101) })).toEqual([
      "Department name must be 100 characters or fewer",
    ]);
  });

  it("rejects a locationId that is not a uuid", () => {
    expect(messages({ name: "Produksi", locationId: "not-a-uuid" })).toEqual([
      "Choose a location",
    ]);
  });
});

describe("departmentNameSchema", () => {
  it("accepts a name alone and drops locationId", () => {
    const parsed = departmentNameSchema.parse({ name: "X" });

    expect(parsed).toEqual({ name: "X" });
    expect("locationId" in parsed).toBe(false);
  });
});
