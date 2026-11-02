import { describe, expect, it } from "vitest";
import { parseRequestSite } from "./request-site";

const SITES = [{ id: "site-a" }, { id: "site-b" }];

describe("parseRequestSite", () => {
  it("defaults to null, which shows every site, when the parameter is missing", () => {
    expect(parseRequestSite(undefined, SITES)).toBeNull();
  });

  it("reads a site id from the choices", () => {
    expect(parseRequestSite("site-b", SITES)).toBe("site-b");
  });

  it("drops an id that is not one of the choices", () => {
    expect(parseRequestSite("site-z", SITES)).toBeNull();
  });

  it("ignores every value when there are no choices", () => {
    expect(parseRequestSite("site-a", [])).toBeNull();
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseRequestSite(["site-a", "site-b"], SITES)).toBe("site-a");
  });
});
