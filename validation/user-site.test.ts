import { describe, expect, it } from "vitest";
import { parseUserSite } from "./user-site";

const SITES = [
  { id: "site-a", name: "Site A" },
  { id: "site-b", name: "Site B" },
];

describe("parseUserSite", () => {
  it("defaults to null, which shows every site, when the parameter is missing", () => {
    expect(parseUserSite(undefined, SITES)).toBeNull();
  });

  it("reads a site id from the choices", () => {
    expect(parseUserSite("site-b", SITES)).toBe("site-b");
  });

  it("drops an id that is not one of the choices", () => {
    expect(parseUserSite("site-z", SITES)).toBeNull();
  });

  it("ignores every value when there are no choices, as for HO with its own site", () => {
    expect(parseUserSite("site-a", [])).toBeNull();
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseUserSite(["site-a", "site-b"], SITES)).toBe("site-a");
  });
});
