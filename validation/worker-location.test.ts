import { describe, expect, it } from "vitest";
import { parseWorkerLocation } from "./worker-location";

const LOCATIONS = [
  { id: "loc-a", siteId: "site-a", name: "Gate" },
  { id: "loc-b", siteId: "site-b", name: "Warehouse" },
];

describe("parseWorkerLocation", () => {
  it("defaults to null, which shows every location, when the parameter is missing", () => {
    expect(parseWorkerLocation(undefined, LOCATIONS)).toBeNull();
  });

  it("reads a location id from the choices", () => {
    expect(parseWorkerLocation("loc-b", LOCATIONS)).toBe("loc-b");
  });

  it("drops an id that is not one of the choices", () => {
    expect(parseWorkerLocation("loc-z", LOCATIONS)).toBeNull();
  });

  it("ignores every value when there are no choices", () => {
    expect(parseWorkerLocation("loc-a", [])).toBeNull();
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseWorkerLocation(["loc-a", "loc-b"], LOCATIONS)).toBe("loc-a");
  });
});
