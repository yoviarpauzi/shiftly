import { describe, expect, it } from "vitest";
import { parseUserStatus } from "./user-status";

describe("parseUserStatus", () => {
  it("defaults to all when the parameter is missing", () => {
    expect(parseUserStatus(undefined)).toBe("all");
  });

  it("reads each supported status", () => {
    expect(parseUserStatus("active")).toBe("active");
    expect(parseUserStatus("banned")).toBe("banned");
    expect(parseUserStatus("all")).toBe("all");
  });

  it("falls back to all for an unknown value", () => {
    expect(parseUserStatus("deleted")).toBe("all");
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseUserStatus(["banned", "all"])).toBe("banned");
  });
});
