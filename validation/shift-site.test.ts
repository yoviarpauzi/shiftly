import { describe, expect, it } from "vitest";
import { parseShiftSite } from "./shift-site";

const SITES = [{ id: "site-a" }, { id: "site-b" }];

describe("parseShiftSite", () => {
  it("reads a site id from the choices", () => {
    expect(parseShiftSite("site-b", SITES)).toBe("site-b");
  });

  it("drops an id that is not one of the choices", () => {
    expect(parseShiftSite("site-z", SITES)).toBeNull();
  });

  it("defaults to null when the parameter is missing", () => {
    expect(parseShiftSite(undefined, SITES)).toBeNull();
  });

  it("ignores every value when there are no choices, as for HO with its own site", () => {
    expect(parseShiftSite("site-a", [])).toBeNull();
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseShiftSite(["site-a", "site-b"], SITES)).toBe("site-a");
  });
});
