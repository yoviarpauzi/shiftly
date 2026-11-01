import { describe, expect, it } from "vitest";
import { parseLocationStatus } from "./location-status";

describe("parseLocationStatus", () => {
  it("defaults to all when the parameter is missing", () => {
    expect(parseLocationStatus(undefined)).toBe("all");
  });

  it("reads each supported status", () => {
    expect(parseLocationStatus("active")).toBe("active");
    expect(parseLocationStatus("deleted")).toBe("deleted");
    expect(parseLocationStatus("all")).toBe("all");
  });

  it("falls back to all for an unknown value", () => {
    expect(parseLocationStatus("archived")).toBe("all");
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseLocationStatus(["deleted", "all"])).toBe("deleted");
  });
});
