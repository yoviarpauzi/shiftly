import { describe, expect, it } from "vitest";
import { parseDepartmentSite } from "./department-site";

const SITES = [
  { id: "site-a", name: "Site A" },
  { id: "site-b", name: "Site B" },
];

describe("parseDepartmentSite", () => {
  it("defaults to null, which shows every site, when the parameter is missing", () => {
    expect(parseDepartmentSite(undefined, SITES)).toBeNull();
  });

  it("reads a site id from the choices", () => {
    expect(parseDepartmentSite("site-b", SITES)).toBe("site-b");
  });

  it("drops an id that is not one of the choices", () => {
    expect(parseDepartmentSite("site-z", SITES)).toBeNull();
  });

  it("ignores every value when there are no choices, as for HO with its own site", () => {
    expect(parseDepartmentSite("site-a", [])).toBeNull();
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseDepartmentSite(["site-a", "site-b"], SITES)).toBe("site-a");
  });
});
