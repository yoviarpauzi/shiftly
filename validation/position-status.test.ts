import { describe, expect, it } from "vitest";
import { parsePositionStatus } from "./position-status";

describe("parsePositionStatus", () => {
  it("passes through active and deleted", () => {
    expect(parsePositionStatus("active")).toBe("active");
    expect(parsePositionStatus("deleted")).toBe("deleted");
  });

  it("falls back to all when the value is missing", () => {
    expect(parsePositionStatus(undefined)).toBe("all");
  });

  it("falls back to all when the value is unknown", () => {
    expect(parsePositionStatus("garbage")).toBe("all");
  });

  it("reads the first value of a repeated param", () => {
    expect(parsePositionStatus(["deleted", "active"])).toBe("deleted");
  });
});
