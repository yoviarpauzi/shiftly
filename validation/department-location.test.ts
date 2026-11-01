import { describe, expect, it } from "vitest";
import { parseDepartmentLocation } from "./department-location";

const locations = [{ id: "loc-1" }, { id: "loc-2" }];

describe("parseDepartmentLocation", () => {
  it("returns an id that is in the list", () => {
    expect(parseDepartmentLocation("loc-2", locations)).toBe("loc-2");
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseDepartmentLocation(["loc-1", "loc-2"], locations)).toBe("loc-1");
  });

  it("returns null for an id that is not in the list", () => {
    expect(parseDepartmentLocation("loc-9", locations)).toBeNull();
  });

  it("returns null when the parameter is missing", () => {
    expect(parseDepartmentLocation(undefined, locations)).toBeNull();
  });

  it("returns null when the list is empty", () => {
    expect(parseDepartmentLocation("loc-1", [])).toBeNull();
  });
});
