import { describe, expect, it } from "vitest";
import { positionSchema } from "./position";

const messages = (input: { name: string }) => {
  const result = positionSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("positionSchema", () => {
  it("rejects an empty name", () => {
    expect(messages({ name: "" })).toEqual(["Position name is required"]);
  });

  it("rejects a name made only of spaces", () => {
    expect(messages({ name: "   " })).toEqual(["Position name is required"]);
  });

  it("trims surrounding spaces", () => {
    expect(positionSchema.parse({ name: "  Cook  " }).name).toBe("Cook");
  });

  it("accepts exactly 100 characters", () => {
    expect(messages({ name: "a".repeat(100) })).toEqual([]);
  });

  it("rejects 101 characters", () => {
    expect(messages({ name: "a".repeat(101) })).toEqual([
      "Position name must be 100 characters or fewer",
    ]);
  });

  it("needs a name alone, and drops any siteId a client still sends", () => {
    const parsed = positionSchema.parse({ name: "Cook", siteId: "11111111-1111-4111-8111-111111111111" });

    expect(parsed).toEqual({ name: "Cook" });
  });
});
