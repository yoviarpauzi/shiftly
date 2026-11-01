import { describe, expect, it } from "vitest";
import { parseUserLocation } from "./user-location";

const LOCATIONS = [
  { id: "loc-a", name: "Gate", siteId: "site-a", siteName: "Site A" },
  { id: "loc-b", name: "Warehouse", siteId: "site-b", siteName: "Site B" },
];

describe("parseUserLocation", () => {
  it("defaults to null, which shows every location, when the parameter is missing", () => {
    expect(parseUserLocation(undefined, LOCATIONS)).toBeNull();
  });

  it("reads a location id from the choices", () => {
    expect(parseUserLocation("loc-b", LOCATIONS)).toBe("loc-b");
  });

  it("drops an id that is not one of the choices", () => {
    expect(parseUserLocation("loc-z", LOCATIONS)).toBeNull();
  });

  it("ignores every value when there are no choices", () => {
    expect(parseUserLocation("loc-a", [])).toBeNull();
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseUserLocation(["loc-a", "loc-b"], LOCATIONS)).toBe("loc-a");
  });
});
