import { describe, expect, it } from "vitest";
import { LOCATION_TIMEZONES, locationSchema } from "./location";

const messages = (input: { name: string; timezone?: string }) => {
  const result = locationSchema.safeParse({
    timezone: "Asia/Jakarta",
    ...input,
  });
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
    expect(
      locationSchema.parse({
        name: "  Kejayan  ",
        timezone: "Asia/Jakarta",
      }).name,
    ).toBe("Kejayan");
  });

  it("accepts exactly 100 characters", () => {
    expect(messages({ name: "a".repeat(100) })).toEqual([]);
  });

  it("rejects 101 characters", () => {
    expect(messages({ name: "a".repeat(101) })).toEqual([
      "Location name must be 100 characters or fewer",
    ]);
  });

  it("accepts a create without a site", () => {
    expect(locationSchema.safeParse({ name: "Kejayan", timezone: "Asia/Jakarta" }).success).toBe(true);
  });

  it("does not carry a siteId through", () => {
    const parsed = locationSchema.parse({
      name: "Kejayan",
      siteId: "11111111-1111-4111-8111-111111111111",
      timezone: "Asia/Jakarta",
    });

    expect(parsed).toEqual({ name: "Kejayan", timezone: "Asia/Jakarta" });
  });

  describe("timezone", () => {
    it("accepts each of the three zones", () => {
      for (const timezone of LOCATION_TIMEZONES) {
        expect(messages({ name: "Kejayan", timezone })).toEqual([]);
      }
    });

    it("rejects a zone outside the list", () => {
      expect(messages({ name: "Kejayan", timezone: "Asia/Singapore" })).toEqual([
        "Choose a time zone",
      ]);
      expect(messages({ name: "Kejayan", timezone: "UTC" })).toEqual([
        "Choose a time zone",
      ]);
    });

    it("rejects an empty or missing zone", () => {
      expect(messages({ name: "Kejayan", timezone: "" })).toEqual([
        "Choose a time zone",
      ]);
      expect(messages({ name: "Kejayan", timezone: undefined })).toEqual([
        "Choose a time zone",
      ]);
    });

    it("lists exactly the three zones, Jakarta first", () => {
      expect([...LOCATION_TIMEZONES]).toEqual([
        "Asia/Jakarta",
        "Asia/Makassar",
        "Asia/Jayapura",
      ]);
    });
  });
});
