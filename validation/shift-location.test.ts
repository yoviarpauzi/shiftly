import { describe, expect, it } from "vitest";
import { parseShiftLocation } from "./shift-location";

const LOCATIONS = [{ id: "location-a" }, { id: "location-b" }];

describe("parseShiftLocation", () => {
  it("reads a location id from the options", () => {
    expect(parseShiftLocation("location-b", LOCATIONS)).toBe("location-b");
  });

  it("drops an id that is not one of the options", () => {
    expect(parseShiftLocation("location-z", LOCATIONS)).toBeNull();
  });

  it("defaults to null when the parameter is missing", () => {
    expect(parseShiftLocation(undefined, LOCATIONS)).toBeNull();
  });

  it("drops an empty value", () => {
    expect(parseShiftLocation("", LOCATIONS)).toBeNull();
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseShiftLocation(["location-a", "location-b"], LOCATIONS)).toBe("location-a");
  });

  it("drops a repeated parameter whose first value is unknown", () => {
    expect(parseShiftLocation(["location-z", "location-b"], LOCATIONS)).toBeNull();
  });

  it("ignores every value when there are no options", () => {
    expect(parseShiftLocation("location-a", [])).toBeNull();
  });
});
