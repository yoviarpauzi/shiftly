import { describe, expect, it } from "vitest";
import { jakartaDate } from "./jakarta-date";

describe("jakartaDate", () => {
  it("rolls over to the next day at 17:00 UTC", () => {
    expect(jakartaDate(new Date("2026-11-30T17:30:00Z"))).toBe("2026-12-01");
  });

  it("stays on the same day just before the rollover", () => {
    expect(jakartaDate(new Date("2026-11-30T16:59:00Z"))).toBe("2026-11-30");
  });

  it("defaults to the current time", () => {
    expect(jakartaDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
