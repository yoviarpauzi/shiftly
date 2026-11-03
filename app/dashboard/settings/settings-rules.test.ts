import { describe, expect, it } from "vitest";
import type { SiteChoice } from "@/types/locations";
import type { LocationChoice, WorkRuleRow } from "@/types/settings";
import {
  DEFAULT_WORK_DAYS,
  effectiveWorkDays,
  INCORRECT_PASSWORD_MESSAGE,
  LOCATION_NOT_FOUND_MESSAGE,
  pickSettingsLocation,
  pickSettingsScope,
  pickSettingsSite,
  READ_ONLY_MESSAGE,
  resolveWorkRules,
  SITE_NOT_FOUND_MESSAGE,
  WORK_RULE_DEFAULTS,
} from "./settings-rules";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";

const row = (fields: Partial<WorkRuleRow>): WorkRuleRow => ({
  workDaysPerWeek: null,
  breakDays: null,
  breakCycleMonths: null,
  annualOffDays: null,
  shiftExceptionDays: null,
  requirePositionMatch: null,
  maxWorkingDaysPerMonth: null,
  ...fields,
});

describe("WORK_RULE_DEFAULTS", () => {
  it("holds the built-in values", () => {
    expect(WORK_RULE_DEFAULTS).toEqual({
      workDaysPerWeek: 5,
      breakDays: 4,
      breakCycleMonths: 3,
      annualOffDays: 20,
      shiftExceptionDays: 7,
      requirePositionMatch: true,
      maxWorkingDaysPerMonth: 26,
    });
    expect(DEFAULT_WORK_DAYS).toBe(5);
  });
});

describe("resolveWorkRules", () => {
  it("falls back to the defaults when no row exists", () => {
    const resolved = resolveWorkRules({ global: null, site: null, location: null });

    expect(resolved.values).toEqual(WORK_RULE_DEFAULTS);
    expect(new Set(Object.values(resolved.sources))).toEqual(new Set(["default"]));
  });

  it("uses the global row over the defaults", () => {
    const resolved = resolveWorkRules({
      global: row({
        workDaysPerWeek: 7,
        breakDays: 2,
        breakCycleMonths: 6,
        annualOffDays: 12,
        shiftExceptionDays: 3,
        requirePositionMatch: false,
        maxWorkingDaysPerMonth: 30,
      }),
      site: null,
      location: null,
    });

    expect(resolved.values).toEqual({
      workDaysPerWeek: 7,
      breakDays: 2,
      breakCycleMonths: 6,
      annualOffDays: 12,
      shiftExceptionDays: 3,
      requirePositionMatch: false,
      maxWorkingDaysPerMonth: 30,
    });
    expect(new Set(Object.values(resolved.sources))).toEqual(new Set(["global"]));
  });

  it("lets location beat site beat global for each rule on its own", () => {
    const resolved = resolveWorkRules({
      global: row({ workDaysPerWeek: 7 }),
      site: row({ annualOffDays: 15 }),
      location: row({ breakDays: 2 }),
    });

    expect(resolved.values.workDaysPerWeek).toBe(7);
    expect(resolved.sources.workDaysPerWeek).toBe("global");
    expect(resolved.values.annualOffDays).toBe(15);
    expect(resolved.sources.annualOffDays).toBe("site");
    expect(resolved.values.breakDays).toBe(2);
    expect(resolved.sources.breakDays).toBe("location");
    expect(resolved.sources.maxWorkingDaysPerMonth).toBe("default");
  });

  it("prefers the most specific level when several set the same rule", () => {
    const resolved = resolveWorkRules({
      global: row({ breakDays: 1 }),
      site: row({ breakDays: 2 }),
      location: row({ breakDays: 3 }),
    });

    expect(resolved.values.breakDays).toBe(3);
    expect(resolved.sources.breakDays).toBe("location");
  });

  it("falls through a null column to the next level", () => {
    const resolved = resolveWorkRules({
      global: row({ breakCycleMonths: 6 }),
      site: row({ breakCycleMonths: null }),
      location: row({ breakCycleMonths: null }),
    });

    expect(resolved.values.breakCycleMonths).toBe(6);
    expect(resolved.sources.breakCycleMonths).toBe("global");
  });

  it("keeps an explicit false for requirePositionMatch", () => {
    const resolved = resolveWorkRules({
      global: null,
      site: null,
      location: row({ requirePositionMatch: false }),
    });

    expect(resolved.values.requirePositionMatch).toBe(false);
    expect(resolved.sources.requirePositionMatch).toBe("location");
  });
});

describe("effectiveWorkDays", () => {
  it("prefers the worker's own value", () => {
    expect(effectiveWorkDays(7, 5)).toBe(7);
    expect(effectiveWorkDays(5, 7)).toBe(5);
  });

  it("falls back to the resolved value", () => {
    expect(effectiveWorkDays(null, 7)).toBe(7);
    expect(effectiveWorkDays(null, 5)).toBe(5);
  });
});

describe("pickSettingsScope", () => {
  it("passes through a valid scope", () => {
    expect(pickSettingsScope("global")).toBe("global");
    expect(pickSettingsScope("site")).toBe("site");
    expect(pickSettingsScope("location")).toBe("location");
  });

  it("defaults to location", () => {
    expect(pickSettingsScope(null)).toBe("location");
    expect(pickSettingsScope("")).toBe("location");
    expect(pickSettingsScope("other")).toBe("location");
  });
});

describe("pickSettingsSite", () => {
  const fixed: SiteChoice = { mode: "fixed", site: { id: SITE_A, name: "Site A" } };
  const pick: SiteChoice = {
    mode: "pick",
    sites: [
      { id: SITE_A, name: "Site A" },
      { id: SITE_B, name: "Site B" },
    ],
  };

  it("always returns the fixed site", () => {
    expect(pickSettingsSite(fixed, SITE_B)).toBe(SITE_A);
    expect(pickSettingsSite(fixed, null)).toBe(SITE_A);
  });

  it("returns the requested site when it is in the list", () => {
    expect(pickSettingsSite(pick, SITE_B)).toBe(SITE_B);
  });

  it("returns the first site when the request is unknown or missing", () => {
    expect(pickSettingsSite(pick, "unknown")).toBe(SITE_A);
    expect(pickSettingsSite(pick, null)).toBe(SITE_A);
  });

  it("returns null when there is no site to pick", () => {
    expect(pickSettingsSite({ mode: "pick", sites: [] }, SITE_A)).toBeNull();
  });
});

describe("pickSettingsLocation", () => {
  const fixed: LocationChoice = {
    mode: "fixed",
    location: { id: LOCATION_A, name: "Location A", siteId: SITE_A },
  };
  const pick: LocationChoice = {
    mode: "pick",
    locations: [
      { id: LOCATION_A, name: "Location A", siteId: SITE_A },
      { id: LOCATION_B, name: "Location B", siteId: SITE_A },
    ],
  };

  it("always returns the fixed location", () => {
    expect(pickSettingsLocation(fixed, LOCATION_B)).toBe(LOCATION_A);
    expect(pickSettingsLocation(fixed, null)).toBe(LOCATION_A);
  });

  it("returns the requested location when it is in the list", () => {
    expect(pickSettingsLocation(pick, LOCATION_B)).toBe(LOCATION_B);
  });

  it("returns the first location when the request is unknown or missing", () => {
    expect(pickSettingsLocation(pick, "unknown")).toBe(LOCATION_A);
    expect(pickSettingsLocation(pick, null)).toBe(LOCATION_A);
  });

  it("returns null when there is no location to pick", () => {
    expect(pickSettingsLocation({ mode: "pick", locations: [] }, LOCATION_A)).toBeNull();
  });
});

describe("messages", () => {
  it("keeps the exact texts", () => {
    expect(SITE_NOT_FOUND_MESSAGE).toBe("Site not found");
    expect(LOCATION_NOT_FOUND_MESSAGE).toBe("Location not found");
    expect(READ_ONLY_MESSAGE).toBe("You can view these work rules but not change them");
    expect(INCORRECT_PASSWORD_MESSAGE).toBe("Current password is incorrect");
  });
});
