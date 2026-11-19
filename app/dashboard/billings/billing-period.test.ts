import { describe, expect, it } from "vitest";

import { defaultPeriodInput, inclusiveDays, MAX_CUSTOM_DAYS, periodFor } from "./billing-period";

describe("periodFor monthly", () => {
  it("covers the whole month", () => {
    expect(periodFor({ mode: "monthly", month: "2026-11" })).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
  });

  it("ends on the 29th in a leap February", () => {
    expect(periodFor({ mode: "monthly", month: "2028-02" })?.to).toBe("2028-02-29");
  });

  it("ends on the 28th in a common February", () => {
    expect(periodFor({ mode: "monthly", month: "2026-02" })?.to).toBe("2026-02-28");
  });

  it("refuses a month that does not exist or is not padded", () => {
    expect(periodFor({ mode: "monthly", month: "2026-13" })).toBeNull();
    expect(periodFor({ mode: "monthly", month: "2026-1" })).toBeNull();
  });
});

describe("periodFor weekly", () => {
  it("returns Monday to Sunday for a midweek date", () => {
    expect(periodFor({ mode: "weekly", date: "2026-11-11" })).toEqual({
      from: "2026-11-09",
      to: "2026-11-15",
    });
  });

  it("keeps a Sunday in the week that it ends", () => {
    expect(periodFor({ mode: "weekly", date: "2026-11-15" })).toEqual({
      from: "2026-11-09",
      to: "2026-11-15",
    });
  });

  it("crosses a year boundary", () => {
    expect(periodFor({ mode: "weekly", date: "2026-12-31" })).toEqual({
      from: "2026-12-28",
      to: "2027-01-03",
    });
  });

  it("refuses a date that is not on the calendar", () => {
    expect(periodFor({ mode: "weekly", date: "2026-02-30" })).toBeNull();
  });
});

describe("periodFor custom", () => {
  it("accepts a single day", () => {
    expect(periodFor({ mode: "custom", from: "2026-11-05", to: "2026-11-05" })).toEqual({
      from: "2026-11-05",
      to: "2026-11-05",
    });
  });

  it("refuses an end before the start", () => {
    expect(periodFor({ mode: "custom", from: "2026-11-06", to: "2026-11-05" })).toBeNull();
  });

  it("accepts exactly 366 days", () => {
    expect(periodFor({ mode: "custom", from: "2026-01-01", to: "2027-01-01" })).not.toBeNull();
  });

  it("refuses 367 days", () => {
    expect(periodFor({ mode: "custom", from: "2026-01-01", to: "2027-01-02" })).toBeNull();
  });

  it("refuses a date that is not on the calendar", () => {
    expect(periodFor({ mode: "custom", from: "2026-02-30", to: "2026-03-05" })).toBeNull();
    expect(periodFor({ mode: "custom", from: "2026-03-01", to: "2026-13-05" })).toBeNull();
  });
});

describe("inclusiveDays", () => {
  it("counts both ends", () => {
    expect(inclusiveDays("2026-11-09", "2026-11-15")).toBe(7);
    expect(inclusiveDays("2026-11-05", "2026-11-05")).toBe(1);
  });
});

it("limits a custom period to 366 days", () => {
  expect(MAX_CUSTOM_DAYS).toBe(366);
});

describe("defaultPeriodInput", () => {
  it("starts monthly on the month of the given day", () => {
    expect(defaultPeriodInput("monthly", "2026-11-19")).toEqual({ mode: "monthly", month: "2026-11" });
  });

  it("starts weekly on the given day", () => {
    expect(defaultPeriodInput("weekly", "2026-11-19")).toEqual({ mode: "weekly", date: "2026-11-19" });
  });

  it("starts custom as that one day", () => {
    expect(defaultPeriodInput("custom", "2026-11-19")).toEqual({
      mode: "custom",
      from: "2026-11-19",
      to: "2026-11-19",
    });
  });

  it.each(["monthly", "weekly", "custom"] as const)("gives a valid %s period", (mode) => {
    expect(periodFor(defaultPeriodInput(mode, "2028-02-29"))).not.toBeNull();
  });
});
