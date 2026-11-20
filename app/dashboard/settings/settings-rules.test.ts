import { describe, expect, it } from "vitest";
import type { LocationChoice, LocationWorkRules, WorkRuleRow } from "@/types/settings";
import {
  appliesToText,
  countText,
  DEFAULT_WORK_DAYS,
  effectiveWorkDays,
  INCORRECT_PASSWORD_MESSAGE,
  LOCATION_NOT_FOUND_MESSAGE,
  pickSettingsLocation,
  pickSettingsScope,
  READ_ONLY_MESSAGE,
  readOnlyNoteFor,
  resolveWorkRules,
  ruleSourceText,
  settingsHref,
  summaryNumber,
  WORK_RULE_DEFAULTS,
  workDaysDescription,
  workRuleCardKey,
  workRulesEmptyFor,
  workRuleTargetFor,
} from "./settings-rules";

const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";

const row = (fields: Partial<WorkRuleRow>): WorkRuleRow => ({
  workDaysPerWeek: null,
  breakDays: null,
  breakCycleMonths: null,
  annualOffDays: null,
  shiftExceptionDays: null,
  requirePositionMatch: null,
  keepPreviousPlacement: null,
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
      keepPreviousPlacement: false,
      maxWorkingDaysPerMonth: 26,
    });
    expect(DEFAULT_WORK_DAYS).toBe(5);
  });
});

describe("resolveWorkRules", () => {
  it("falls back to the defaults when no row exists", () => {
    const resolved = resolveWorkRules({ global: null, location: null });

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
        keepPreviousPlacement: true,
        maxWorkingDaysPerMonth: 30,
      }),
      location: null,
    });

    expect(resolved.values).toEqual({
      workDaysPerWeek: 7,
      breakDays: 2,
      breakCycleMonths: 6,
      annualOffDays: 12,
      shiftExceptionDays: 3,
      requirePositionMatch: false,
      keepPreviousPlacement: true,
      maxWorkingDaysPerMonth: 30,
    });
    expect(new Set(Object.values(resolved.sources))).toEqual(new Set(["global"]));
  });

  it("lets location beat global for each rule on its own", () => {
    const resolved = resolveWorkRules({
      global: row({ workDaysPerWeek: 7, breakDays: 1 }),
      location: row({ breakDays: 2 }),
    });

    expect(resolved.values.workDaysPerWeek).toBe(7);
    expect(resolved.sources.workDaysPerWeek).toBe("global");
    expect(resolved.values.breakDays).toBe(2);
    expect(resolved.sources.breakDays).toBe("location");
    expect(resolved.sources.maxWorkingDaysPerMonth).toBe("default");
  });

  it("has no site level: a row given as site is not read", () => {
    const resolved = resolveWorkRules({
      global: row({ annualOffDays: 12 }),
      location: null,
      site: row({ annualOffDays: 15 }),
    } as never);

    expect(resolved.values.annualOffDays).toBe(12);
    expect(resolved.sources.annualOffDays).toBe("global");
    expect(Object.values(resolved.sources)).not.toContain("site");
  });

  it("inherits global when the location has no row of its own", () => {
    const resolved = resolveWorkRules({
      global: row({ workDaysPerWeek: 7, requirePositionMatch: false }),
      location: null,
    });

    expect(resolved.values.workDaysPerWeek).toBe(7);
    expect(resolved.values.requirePositionMatch).toBe(false);
    expect(resolved.sources.workDaysPerWeek).toBe("global");
    expect(resolved.sources.requirePositionMatch).toBe("global");
  });

  it("falls through a null column to the next level", () => {
    const resolved = resolveWorkRules({
      global: row({ breakCycleMonths: 6 }),
      location: row({ breakCycleMonths: null }),
    });

    expect(resolved.values.breakCycleMonths).toBe(6);
    expect(resolved.sources.breakCycleMonths).toBe("global");
  });

  it("keeps an explicit false for requirePositionMatch", () => {
    const resolved = resolveWorkRules({
      global: null,
      location: row({ requirePositionMatch: false }),
    });

    expect(resolved.values.requirePositionMatch).toBe(false);
    expect(resolved.sources.requirePositionMatch).toBe("location");
  });
});

describe("keepPreviousPlacement resolution", () => {
  it("is off when no level sets it, so existing rows with a null column change nothing", () => {
    const resolved = resolveWorkRules({ global: row({}), location: row({}) });

    expect(resolved.values.keepPreviousPlacement).toBe(false);
    expect(resolved.sources.keepPreviousPlacement).toBe("default");
  });

  it("keeps an explicit false at a location over a true at global", () => {
    const resolved = resolveWorkRules({
      global: row({ keepPreviousPlacement: true }),
      location: row({ keepPreviousPlacement: false }),
    });

    expect(resolved.values.keepPreviousPlacement).toBe(false);
    expect(resolved.sources.keepPreviousPlacement).toBe("location");
  });

  it("lets a location with a null column inherit global's true", () => {
    const resolved = resolveWorkRules({
      global: row({ keepPreviousPlacement: true }),
      location: row({ keepPreviousPlacement: null }),
    });

    expect(resolved.values.keepPreviousPlacement).toBe(true);
    expect(resolved.sources.keepPreviousPlacement).toBe("global");
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
    expect(pickSettingsScope("location")).toBe("location");
  });

  it("no longer knows the site level", () => {
    expect(pickSettingsScope("site")).toBe("location");
  });

  it("defaults to location", () => {
    expect(pickSettingsScope(null)).toBe("location");
    expect(pickSettingsScope("")).toBe("location");
    expect(pickSettingsScope("other")).toBe("location");
  });
});

describe("pickSettingsLocation", () => {
  const fixed: LocationChoice = {
    mode: "fixed",
    location: { id: LOCATION_A, name: "Location A" },
  };
  const pick: LocationChoice = {
    mode: "pick",
    locations: [
      { id: LOCATION_A, name: "Location A" },
      { id: LOCATION_B, name: "Location B" },
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
    expect(LOCATION_NOT_FOUND_MESSAGE).toBe("Location not found");
    expect(READ_ONLY_MESSAGE).toBe("You can view these work rules but not change them");
    expect(INCORRECT_PASSWORD_MESSAGE).toBe("Current password is incorrect");
  });
});

describe("ruleSourceText", () => {
  it("describes the global level the same way whatever the source", () => {
    for (const source of ["global", "default"] as const) {
      expect(ruleSourceText({ scope: "global", source, own: true })).toBe(
        "Applies to every location that does not set its own.",
      );
    }
  });

  it("says the value is set at the chosen level", () => {
    expect(ruleSourceText({ scope: "location", source: "location", own: true })).toBe(
      "Set for this location",
    );
  });

  it("treats the built-in default as inherited from global", () => {
    for (const source of ["global", "default"] as const) {
      expect(ruleSourceText({ scope: "location", source, own: false })).toBe(
        "Inherited from global",
      );
    }
  });

  it("never names a site", () => {
    for (const source of ["global", "default", "location"] as const) {
      for (const own of [true, false]) {
        expect(ruleSourceText({ scope: "location", source, own }).toLowerCase()).not.toContain(
          "site",
        );
      }
    }
  });
});

describe("scope copy", () => {
  it("changes the working-days description with the scope", () => {
    expect(workDaysDescription("global")).toBe(
      "Default for workers in every location that does not set its own. A worker's own setting, chosen in the Worker menu, takes priority.",
    );
    expect(workDaysDescription("location")).toBe(
      "Default for workers in this location. A worker's own setting, chosen in the Worker menu, takes priority.",
    );
  });

  it("changes the applies-to helper with the scope", () => {
    expect(appliesToText("global")).toBe(
      "Applies to all workers in every location unless a location sets its own.",
    );
    expect(appliesToText("location")).toBe("Applies to all workers in this location.");
  });

  it("explains who can change a read-only level", () => {
    expect(readOnlyNoteFor("global")).toBe("Only HO can change global rules.");
    expect(readOnlyNoteFor("location")).toBeNull();
  });
});

describe("workRulesEmptyFor", () => {
  it("is no-location only at location scope without a location", () => {
    expect(workRulesEmptyFor({ scope: "location", locationId: null })).toBe("no-location");
    expect(workRulesEmptyFor({ scope: "global", locationId: null })).toBeNull();
  });

  it("is null when the target resolves", () => {
    expect(workRulesEmptyFor({ scope: "location", locationId: LOCATION_A })).toBeNull();
    expect(workRulesEmptyFor({ scope: "global", locationId: LOCATION_A })).toBeNull();
  });
});

describe("settingsHref", () => {
  it("drops the location at global level and keeps it at location level", () => {
    expect(settingsHref({ scope: "global", locationId: LOCATION_A })).toBe(
      "/dashboard/settings?scope=global",
    );
    expect(settingsHref({ scope: "location", locationId: LOCATION_A })).toBe(
      `/dashboard/settings?scope=location&location=${LOCATION_A}`,
    );
  });

  it("leaves out a missing location", () => {
    expect(settingsHref({ scope: "location", locationId: null })).toBe(
      "/dashboard/settings?scope=location",
    );
  });
});

describe("workRuleCardKey", () => {
  const CARDS = [
    "workDaysPerWeek",
    "maxWorkingDaysPerMonth",
    "breakDays",
    "annualOffDays",
    "shiftExceptionDays",
    "requirePositionMatch",
    "keepPreviousPlacement",
  ] as const;
  const noneOwn = {
    workDaysPerWeek: false,
    breakDays: false,
    breakCycleMonths: false,
    annualOffDays: false,
    shiftExceptionDays: false,
    requirePositionMatch: false,
    keepPreviousPlacement: false,
    maxWorkingDaysPerMonth: false,
  };
  const level = (
    fields: Partial<Pick<LocationWorkRules, "scope" | "locationId" | "own">>,
  ): Pick<LocationWorkRules, "scope" | "locationId" | "own"> => ({
    scope: "location",
    locationId: LOCATION_A,
    own: noneOwn,
    ...fields,
  });

  it("gives each card its own key on the same level", () => {
    for (const rules of [level({}), level({ scope: "global", locationId: null })]) {
      const keys = CARDS.map((card) => workRuleCardKey(card, rules));

      expect(new Set(keys).size).toBe(CARDS.length);
    }
  });

  it("changes with the level and the location", () => {
    const base = workRuleCardKey("breakDays", level({}));

    expect(workRuleCardKey("breakDays", level({ scope: "global", locationId: null }))).not.toBe(
      base,
    );
    expect(workRuleCardKey("breakDays", level({ locationId: LOCATION_B }))).not.toBe(base);
  });

  it("changes when the level starts or stops setting the card's own value", () => {
    const base = workRuleCardKey("breakDays", level({}));

    expect(workRuleCardKey("breakDays", level({ own: { ...noneOwn, breakDays: true } }))).not.toBe(
      base,
    );
    expect(
      workRuleCardKey("breakDays", level({ own: { ...noneOwn, annualOffDays: true } })),
    ).toBe(base);
  });
});

describe("countText", () => {
  it("uses the singular for exactly one", () => {
    expect(countText(1, "break day")).toBe("1 break day");
    expect(countText(1, "month")).toBe("1 month");
  });

  it("uses the plural for every other count", () => {
    expect(countText(0, "break day")).toBe("0 break days");
    expect(countText(4, "break day")).toBe("4 break days");
    expect(countText(12, "month")).toBe("12 months");
  });
});

describe("summaryNumber", () => {
  it("gives the number for whole-number text", () => {
    expect(summaryNumber("20")).toBe(20);
    expect(summaryNumber(" 4 ")).toBe(4);
  });

  it("gives null for text the summary should not echo", () => {
    for (const text of ["", " ", "abc", "1.5", "4a"]) {
      expect(summaryNumber(text)).toBeNull();
    }
  });
});

describe("workRuleTargetFor", () => {
  it("builds the action target from the loaded level", () => {
    expect(workRuleTargetFor({ scope: "global", locationId: null })).toEqual({ scope: "global" });
    expect(workRuleTargetFor({ scope: "location", locationId: LOCATION_A })).toEqual({
      scope: "location",
      locationId: LOCATION_A,
    });
  });
});
