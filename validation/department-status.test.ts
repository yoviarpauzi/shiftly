import { describe, expect, it } from "vitest";
import { parseDepartmentStatus } from "./department-status";

describe("parseDepartmentStatus", () => {
  it("defaults to all when the parameter is missing", () => {
    expect(parseDepartmentStatus(undefined)).toBe("all");
  });

  it("reads each supported status", () => {
    expect(parseDepartmentStatus("active")).toBe("active");
    expect(parseDepartmentStatus("deleted")).toBe("deleted");
    expect(parseDepartmentStatus("all")).toBe("all");
  });

  it("falls back to all for an unknown value", () => {
    expect(parseDepartmentStatus("archived")).toBe("all");
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseDepartmentStatus(["deleted", "all"])).toBe("deleted");
  });

  it("falls back to all for an empty array", () => {
    expect(parseDepartmentStatus([])).toBe("all");
  });
});
