import { describe, expect, it } from "vitest";
import { parseRequestStatus, parseRequestType } from "./request-status";

describe("parseRequestStatus", () => {
  it("passes through each known status and all", () => {
    for (const status of ["pending", "approved", "rejected", "cancelled", "all"]) {
      expect(parseRequestStatus(status)).toBe(status);
    }
  });

  it("falls back to all when the value is missing or unknown", () => {
    expect(parseRequestStatus(undefined)).toBe("all");
    expect(parseRequestStatus("garbage")).toBe("all");
  });

  it("reads the first value of a repeated param", () => {
    expect(parseRequestStatus(["approved", "pending"])).toBe("approved");
  });
});

describe("parseRequestType", () => {
  it("passes through daily, weekly, and all", () => {
    for (const type of ["daily", "weekly", "all"]) {
      expect(parseRequestType(type)).toBe(type);
    }
  });

  it("falls back to all when the value is missing or unknown", () => {
    expect(parseRequestType(undefined)).toBe("all");
    expect(parseRequestType("monthly")).toBe("all");
  });

  it("reads the first value of a repeated param", () => {
    expect(parseRequestType(["weekly", "daily"])).toBe("weekly");
  });
});
