import { describe, expect, it } from "vitest";

import { isCalendarDate } from "./calendar-date";

describe("isCalendarDate", () => {
  it.each(["2026-11-02", "2028-02-29", "2026-12-31"])("accepts %s", (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each([
    ["a day the month does not have", "2026-02-30"],
    ["a month above 12", "2026-13-01"],
    ["a leap day in a common year", "2027-02-29"],
    ["a slash format", "11/02/2026"],
    ["unpadded parts", "2026-1-5"],
    ["an empty string", ""],
    ["a timestamp", "2026-11-02T00:00:00Z"],
  ])("rejects %s", (_label, value) => {
    expect(isCalendarDate(value)).toBe(false);
  });
});
