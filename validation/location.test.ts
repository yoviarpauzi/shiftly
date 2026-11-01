import { describe, expect, it } from "vitest";
import { locationSchema } from "./location";

const SITE_ID = "11111111-1111-4111-8111-111111111111";

const messages = (input: { name: string; siteId?: string }) => {
  const result = locationSchema.safeParse({ siteId: SITE_ID, ...input });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("locationSchema", () => {
  it("rejects an empty name", () => {
    expect(messages({ name: "" })).toEqual(["Location name is required"]);
  });

  it("rejects a name made only of spaces", () => {
    expect(messages({ name: "   " })).toEqual(["Location name is required"]);
  });

  it("trims surrounding spaces", () => {
    expect(locationSchema.parse({ name: "  Kejayan  ", siteId: SITE_ID }).name).toBe(
      "Kejayan",
    );
  });

  it("accepts exactly 100 characters", () => {
    expect(messages({ name: "a".repeat(100) })).toEqual([]);
  });

  it("rejects 101 characters", () => {
    expect(messages({ name: "a".repeat(101) })).toEqual([
      "Location name must be 100 characters or fewer",
    ]);
  });

  it("rejects a siteId that is not a uuid", () => {
    expect(messages({ name: "Kejayan", siteId: "not-a-uuid" })).toEqual([
      "Choose a site",
    ]);
  });
});
