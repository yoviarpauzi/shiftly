import { describe, expect, it } from "vitest";
import { parseWorkerPosition } from "./worker-position";

const POSITIONS = [
  { id: "pos-a", siteId: "site-a", name: "Forklift Driver" },
  { id: "pos-b", siteId: "site-a", name: "Helper" },
];

describe("parseWorkerPosition", () => {
  it("defaults to null, which shows every position, when the parameter is missing", () => {
    expect(parseWorkerPosition(undefined, POSITIONS)).toBeNull();
  });

  it("reads a position id from the choices", () => {
    expect(parseWorkerPosition("pos-b", POSITIONS)).toBe("pos-b");
  });

  it("drops an id that is not one of the choices", () => {
    expect(parseWorkerPosition("pos-z", POSITIONS)).toBeNull();
  });

  it("ignores every value when there are no choices, as for superadmin before it picks a site", () => {
    expect(parseWorkerPosition("pos-a", [])).toBeNull();
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseWorkerPosition(["pos-a", "pos-b"], POSITIONS)).toBe("pos-a");
  });
});
