import { describe, expect, it } from "vitest";
import { parseSiteStatus } from "./site-rules";

describe("parseSiteStatus", () => {
  it("defaults to active when the parameter is missing", () => {
    expect(parseSiteStatus(undefined)).toBe("active");
  });

  it("reads each supported status", () => {
    expect(parseSiteStatus("active")).toBe("active");
    expect(parseSiteStatus("deleted")).toBe("deleted");
    expect(parseSiteStatus("all")).toBe("all");
  });

  it("falls back to active for an unknown value", () => {
    expect(parseSiteStatus("archived")).toBe("active");
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseSiteStatus(["deleted", "all"])).toBe("deleted");
  });
});
