import { describe, expect, it } from "vitest";
import { parseRequestLocation } from "./request-location";

const LOCATIONS = [{ id: "loc-a" }, { id: "loc-b" }];

describe("parseRequestLocation", () => {
  it("reads a location id from the choices", () => {
    expect(parseRequestLocation("loc-b", LOCATIONS)).toBe("loc-b");
  });

  it("defaults to null when the value is missing or not one of the choices", () => {
    expect(parseRequestLocation(undefined, LOCATIONS)).toBeNull();
    expect(parseRequestLocation("loc-z", LOCATIONS)).toBeNull();
    expect(parseRequestLocation("", LOCATIONS)).toBeNull();
  });

  it("ignores every value when there are no choices", () => {
    expect(parseRequestLocation("loc-a", [])).toBeNull();
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseRequestLocation(["loc-a", "loc-b"], LOCATIONS)).toBe("loc-a");
  });
});
