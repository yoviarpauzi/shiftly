import { describe, expect, it } from "vitest";
import { parseSiteStatus } from "./site-rules";

describe("parseSiteStatus", () => {
  it("defaults to all when the parameter is missing", () => {
    expect(parseSiteStatus(undefined)).toBe("all");
  });

  it("reads each supported status", () => {
    expect(parseSiteStatus("active")).toBe("active");
    expect(parseSiteStatus("deleted")).toBe("deleted");
    expect(parseSiteStatus("all")).toBe("all");
  });

  it("falls back to all for an unknown value", () => {
    expect(parseSiteStatus("archived")).toBe("all");
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseSiteStatus(["deleted", "all"])).toBe("deleted");
  });
});
