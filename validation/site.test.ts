import { describe, expect, it } from "vitest";
import { siteSchema } from "./site";

const messages = (name: string) => {
  const result = siteSchema.safeParse({ name });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("siteSchema", () => {
  it("rejects an empty name", () => {
    expect(messages("")).toEqual(["Site name is required"]);
  });

  it("rejects a name made only of spaces", () => {
    expect(messages("   ")).toEqual(["Site name is required"]);
  });

  it("trims surrounding spaces", () => {
    expect(siteSchema.parse({ name: "  Nestle  " }).name).toBe("Nestle");
  });

  it("accepts exactly 100 characters", () => {
    expect(messages("a".repeat(100))).toEqual([]);
  });

  it("rejects 101 characters", () => {
    expect(messages("a".repeat(101))).toEqual([
      "Site name must be 100 characters or fewer",
    ]);
  });
});
