import { describe, expect, it } from "vitest";
import { parseShiftStatus } from "./shift-status";

describe("parseShiftStatus", () => {
  it("passes through active, deleted, and all", () => {
    expect(parseShiftStatus("active")).toBe("active");
    expect(parseShiftStatus("deleted")).toBe("deleted");
    expect(parseShiftStatus("all")).toBe("all");
  });

  it("falls back to all when the value is missing", () => {
    expect(parseShiftStatus(undefined)).toBe("all");
  });

  it("falls back to all when the value is unknown", () => {
    expect(parseShiftStatus("garbage")).toBe("all");
  });

  it("reads the first value of a repeated param", () => {
    expect(parseShiftStatus(["deleted", "active"])).toBe("deleted");
  });
});
