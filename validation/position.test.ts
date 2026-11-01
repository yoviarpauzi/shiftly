import { describe, expect, it } from "vitest";
import { positionNameSchema, positionSchema } from "./position";

const SITE_ID = "11111111-1111-4111-8111-111111111111";

const messages = (input: { name: string; siteId?: string }) => {
  const result = positionSchema.safeParse({ siteId: SITE_ID, ...input });
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
    expect(positionSchema.parse({ name: "  Cook  ", siteId: SITE_ID }).name).toBe("Cook");
  });

  it("accepts exactly 100 characters", () => {
    expect(messages({ name: "a".repeat(100) })).toEqual([]);
  });

  it("rejects 101 characters", () => {
    expect(messages({ name: "a".repeat(101) })).toEqual([
      "Position name must be 100 characters or fewer",
    ]);
  });

  it("rejects a siteId that is not a uuid", () => {
    expect(messages({ name: "Cook", siteId: "not-a-uuid" })).toEqual(["Choose a site"]);
  });
});

describe("positionNameSchema", () => {
  it("accepts a name alone and drops siteId", () => {
    const parsed = positionNameSchema.parse({ name: "Cook" });

    expect(parsed).toEqual({ name: "Cook" });
    expect("siteId" in parsed).toBe(false);
  });
});
