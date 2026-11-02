import { describe, expect, it } from "vitest";
import { parseWorkerSite } from "./worker-site";

const SITES = [
  { id: "site-a", name: "Site A" },
  { id: "site-b", name: "Site B" },
];

describe("parseWorkerSite", () => {
  it("defaults to null, which shows every site, when the parameter is missing", () => {
    expect(parseWorkerSite(undefined, SITES)).toBeNull();
  });

  it("reads a site id from the choices", () => {
    expect(parseWorkerSite("site-b", SITES)).toBe("site-b");
  });

  it("drops an id that is not one of the choices", () => {
    expect(parseWorkerSite("site-z", SITES)).toBeNull();
  });

  it("ignores every value when there are no choices, as for HO and admin site", () => {
    expect(parseWorkerSite("site-a", [])).toBeNull();
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseWorkerSite(["site-a", "site-b"], SITES)).toBe("site-a");
  });
});
