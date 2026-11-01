import { describe, expect, it } from "vitest";
import { parseLocationSite } from "./location-site";

const SITES = [
  { id: "site-a", name: "Site A" },
  { id: "site-b", name: "Site B" },
];

describe("parseLocationSite", () => {
  it("defaults to null, which shows every site, when the parameter is missing", () => {
    expect(parseLocationSite(undefined, SITES)).toBeNull();
  });

  it("reads a site id from the choices", () => {
    expect(parseLocationSite("site-b", SITES)).toBe("site-b");
  });

  it("drops an id that is not one of the choices", () => {
    expect(parseLocationSite("site-z", SITES)).toBeNull();
  });

  it("drops an empty value", () => {
    expect(parseLocationSite("", SITES)).toBeNull();
  });

  it("ignores every value when there are no choices, as for a manager with one fixed site", () => {
    expect(parseLocationSite("site-a", [])).toBeNull();
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseLocationSite(["site-a", "site-b"], SITES)).toBe("site-a");
  });
});
