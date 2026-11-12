import { describe, expect, it } from "vitest";
import {
  WORK_DAYS,
  WORK_RULE_LIMITS,
  annualOffRuleSchema,
  breakRuleSchema,
  changePasswordSchema,
  maxWorkingDaysRuleSchema,
  parseSettingsLocation,
  parseSettingsScope,
  placementRuleSchema,
  qualificationRuleSchema,
  shiftChangeRuleSchema,
  toWholeNumber,
  workDaysRuleSchema,
  workRuleFormErrors,
  workRuleTargetSchema,
} from "./settings";

const SITE_ID = "11111111-1111-4111-8111-111111111111";
const LOCATION_ID = "22222222-2222-4222-8222-222222222222";

const targets = {
  global: { scope: "global" },
  site: { scope: "site", siteId: SITE_ID },
  location: { scope: "location", locationId: LOCATION_ID },
} as const;

const inheritingScopes = ["site", "location"] as const;
const allScopes = ["global", "site", "location"] as const;

describe("WORK_DAYS", () => {
  it("allows 5 and 7", () => {
    expect(WORK_DAYS).toEqual([5, 7]);
  });
});

describe("changePasswordSchema", () => {
  const base = {
    currentPassword: "old-password",
    newPassword: "new-password-1",
    confirmPassword: "new-password-1",
  };

  const issues = (input: Record<string, unknown>) => {
    const result = changePasswordSchema.safeParse({ ...base, ...input });
    return result.success
      ? []
      : result.error.issues.map((issue) => ({ path: issue.path, message: issue.message }));
  };

  it("accepts the valid base", () => {
    expect(changePasswordSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a new password of 7 characters", () => {
    const newPassword = "a".repeat(7);
    expect(issues({ newPassword, confirmPassword: newPassword })).toEqual([
      { path: ["newPassword"], message: "Password must be at least 8 characters" },
    ]);
  });

  it("accepts a new password of exactly 8 and exactly 128 characters", () => {
    for (const length of [8, 128]) {
      const newPassword = "a".repeat(length);
      expect(issues({ newPassword, confirmPassword: newPassword })).toEqual([]);
    }
  });

  it("rejects a new password of 129 characters", () => {
    const newPassword = "a".repeat(129);
    expect(issues({ newPassword, confirmPassword: newPassword })).toEqual([
      { path: ["newPassword"], message: "Password must be 128 characters or fewer" },
    ]);
  });

  it("rejects a current password over 128 characters", () => {
    const result = issues({ currentPassword: "a".repeat(129) });
    expect(result.map((issue) => issue.path)).toEqual([["currentPassword"]]);
  });

  it("rejects an empty current password", () => {
    expect(issues({ currentPassword: "" })).toEqual([
      { path: ["currentPassword"], message: "Current password is required" },
    ]);
  });

  it("rejects a confirmation that differs from the new password", () => {
    expect(issues({ confirmPassword: "something-else-1" })).toEqual([
      { path: ["confirmPassword"], message: "Passwords do not match" },
    ]);
  });

  it("rejects a new password equal to the current one", () => {
    expect(
      issues({
        currentPassword: "same-password-1",
        newPassword: "same-password-1",
        confirmPassword: "same-password-1",
      }),
    ).toEqual([
      {
        path: ["newPassword"],
        message: "New password must be different from the current one",
      },
    ]);
  });
});

describe("workRuleTargetSchema", () => {
  const messages = (input: unknown) => {
    const result = workRuleTargetSchema.safeParse(input);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  };

  it("accepts a global target", () => {
    expect(workRuleTargetSchema.safeParse(targets.global).success).toBe(true);
  });

  it("accepts a site target and a location target", () => {
    expect(workRuleTargetSchema.safeParse(targets.site).success).toBe(true);
    expect(workRuleTargetSchema.safeParse(targets.location).success).toBe(true);
  });

  it("rejects a site id that is not a uuid", () => {
    expect(messages({ scope: "site", siteId: "nope" })).toEqual(["Choose a site"]);
  });

  it("rejects a location id that is not a uuid", () => {
    expect(messages({ scope: "location", locationId: "nope" })).toEqual(["Choose a location"]);
  });

  it("rejects a site target without a site id", () => {
    expect(messages({ scope: "site" })).toEqual(["Choose a site"]);
  });

  it("rejects a site target that also carries a location id", () => {
    expect(workRuleTargetSchema.safeParse({ ...targets.site, locationId: LOCATION_ID }).success).toBe(
      false,
    );
  });

  it("rejects a global target that carries an id", () => {
    expect(workRuleTargetSchema.safeParse({ scope: "global", siteId: SITE_ID }).success).toBe(false);
    expect(workRuleTargetSchema.safeParse({ scope: "global", locationId: LOCATION_ID }).success).toBe(
      false,
    );
  });

  it("rejects an unknown scope", () => {
    expect(workRuleTargetSchema.safeParse({ scope: "region" }).success).toBe(false);
  });
});

describe("workDaysRuleSchema", () => {
  const parse = (scope: keyof typeof targets, workDaysPerWeek: unknown) =>
    workDaysRuleSchema.safeParse({ target: targets[scope], workDaysPerWeek });

  const messages = (scope: keyof typeof targets, workDaysPerWeek: unknown) => {
    const result = parse(scope, workDaysPerWeek);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  };

  it.each(allScopes)("accepts 5 and 7 at %s scope", (scope) => {
    expect(parse(scope, 5).success).toBe(true);
    expect(parse(scope, 7).success).toBe(true);
  });

  it("rejects 6", () => {
    expect(messages("global", 6)).toEqual(["Choose 5 or 7 days"]);
  });

  it('rejects the string "5"', () => {
    expect(messages("global", "5")).toEqual(["Choose 5 or 7 days"]);
  });

  it.each(inheritingScopes)("accepts null at %s scope", (scope) => {
    expect(parse(scope, null).success).toBe(true);
  });

  it("rejects null at global scope", () => {
    expect(messages("global", null)).toEqual(["Choose 5 or 7 days"]);
  });

  it("reports the null error on the field", () => {
    const result = parse("global", null);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toEqual([
      ["workDaysPerWeek"],
    ]);
  });
});

const numberCards = [
  { name: "breakDays", schema: breakRuleSchema, extra: { breakCycleMonths: 1 } },
  { name: "breakCycleMonths", schema: breakRuleSchema, extra: { breakDays: 1 } },
  { name: "annualOffDays", schema: annualOffRuleSchema, extra: {} },
  { name: "shiftExceptionDays", schema: shiftChangeRuleSchema, extra: {} },
  { name: "maxWorkingDaysPerMonth", schema: maxWorkingDaysRuleSchema, extra: {} },
] as const;

describe.each(numberCards)("$name", ({ name, schema, extra }) => {
  const limits = WORK_RULE_LIMITS[name];
  const parse = (scope: keyof typeof targets, value: unknown) =>
    schema.safeParse({ target: targets[scope], ...extra, [name]: value });
  const messages = (scope: keyof typeof targets, value: unknown) => {
    const result = parse(scope, value);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  };

  it("accepts the minimum and the maximum", () => {
    expect(parse("global", limits.min).success).toBe(true);
    expect(parse("global", limits.max).success).toBe(true);
  });

  it("rejects a value below the minimum and above the maximum", () => {
    const message = `Enter a number from ${limits.min} to ${limits.max}`;
    expect(messages("global", limits.min - 1)).toEqual([message]);
    expect(messages("global", limits.max + 1)).toEqual([message]);
  });

  it.each([3.5, Number.NaN, "3"])("rejects %j as not a whole number", (value) => {
    expect(messages("global", value)).toEqual(["Enter a whole number"]);
  });

  it("rejects an empty string rather than reading it as 0", () => {
    expect(parse("global", "").success).toBe(false);
  });

  it.each(inheritingScopes)("accepts null at %s scope", (scope) => {
    expect(parse(scope, null).success).toBe(true);
  });

  it("rejects null at global scope, on the field", () => {
    const result = parse("global", null);
    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toEqual([[name]]);
  });
});

describe("WORK_RULE_LIMITS", () => {
  it("holds the agreed ranges", () => {
    expect(WORK_RULE_LIMITS).toEqual({
      breakDays: { min: 1, max: 31 },
      breakCycleMonths: { min: 1, max: 12 },
      annualOffDays: { min: 0, max: 366 },
      shiftExceptionDays: { min: 1, max: 30 },
      maxWorkingDaysPerMonth: { min: 1, max: 31 },
    });
  });

  it("lets annual off be 0", () => {
    expect(
      annualOffRuleSchema.safeParse({ target: targets.global, annualOffDays: 0 }).success,
    ).toBe(true);
  });
});

describe("breakRuleSchema", () => {
  it("checks both fields together", () => {
    const result = breakRuleSchema.safeParse({
      target: targets.global,
      breakDays: 0,
      breakCycleMonths: 13,
    });
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toEqual([
      ["breakDays"],
      ["breakCycleMonths"],
    ]);
  });

  it("refuses a null on either field at global scope", () => {
    const result = breakRuleSchema.safeParse({
      target: targets.global,
      breakDays: null,
      breakCycleMonths: null,
    });
    expect(result.success ? [] : result.error.issues.map((issue) => issue.path)).toEqual([
      ["breakDays"],
      ["breakCycleMonths"],
    ]);
  });
});

describe("qualificationRuleSchema", () => {
  const parse = (scope: keyof typeof targets, requirePositionMatch: unknown) =>
    qualificationRuleSchema.safeParse({ target: targets[scope], requirePositionMatch });
  const messages = (scope: keyof typeof targets, requirePositionMatch: unknown) => {
    const result = parse(scope, requirePositionMatch);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  };

  it.each(allScopes)("accepts true and false at %s scope", (scope) => {
    expect(parse(scope, true).success).toBe(true);
    expect(parse(scope, false).success).toBe(true);
  });

  it.each(["true", 1])("rejects %j", (value) => {
    expect(messages("global", value)).toEqual(["Choose on or off"]);
  });

  it.each(inheritingScopes)("accepts null at %s scope", (scope) => {
    expect(parse(scope, null).success).toBe(true);
  });

  it("rejects null at global scope", () => {
    expect(messages("global", null)).toEqual(["Choose on or off"]);
  });
});

describe("placementRuleSchema", () => {
  const parse = (scope: keyof typeof targets, keepPreviousPlacement: unknown) =>
    placementRuleSchema.safeParse({ target: targets[scope], keepPreviousPlacement });
  const messages = (scope: keyof typeof targets, keepPreviousPlacement: unknown) => {
    const result = parse(scope, keepPreviousPlacement);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  };

  it.each(allScopes)("accepts true and false at %s scope", (scope) => {
    expect(parse(scope, true).success).toBe(true);
    expect(parse(scope, false).success).toBe(true);
  });

  it.each(["yes", 1])("rejects %j", (value) => {
    expect(messages("global", value)).toEqual(["Choose on or off"]);
  });

  it.each(inheritingScopes)("accepts null at %s scope", (scope) => {
    expect(parse(scope, null).success).toBe(true);
  });

  it("rejects null at global scope", () => {
    expect(messages("global", null)).toEqual(["Choose on or off"]);
  });
});

describe("toWholeNumber", () => {
  it("converts whole-number text", () => {
    expect(toWholeNumber("26")).toBe(26);
    expect(toWholeNumber(" 4 ")).toBe(4);
    expect(toWholeNumber("0")).toBe(0);
  });

  it("returns NaN for blank or non-integer text", () => {
    for (const text of ["", "  ", "1.5", "abc", "4a", "1e2", "-", "+"]) {
      expect(toWholeNumber(text)).toBeNaN();
    }
  });

  it("keeps a negative whole number so the range check rejects it", () => {
    expect(toWholeNumber("-3")).toBe(-3);
  });

  it("gives the schema a value it rejects with the whole-number message", () => {
    const parsed = annualOffRuleSchema.safeParse({
      target: { scope: "global" },
      annualOffDays: toWholeNumber(""),
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe("Enter a whole number");
  });
});

describe("workRuleFormErrors", () => {
  it("keeps the first message per field and moves target issues to the form", () => {
    const parsed = breakRuleSchema.safeParse({
      target: { scope: "site", siteId: "not-a-uuid" },
      breakDays: toWholeNumber("x"),
      breakCycleMonths: 13,
    });

    expect(parsed.success).toBe(false);
    expect(workRuleFormErrors(parsed.error?.issues ?? [])).toEqual({
      form: "Choose a site",
      fields: {
        breakDays: { message: "Enter a whole number" },
        breakCycleMonths: { message: "Enter a number from 1 to 12" },
      },
    });
  });
});

describe("parseSettingsScope", () => {
  it("keeps a known scope", () => {
    expect(parseSettingsScope("global")).toBe("global");
    expect(parseSettingsScope(["site", "global"])).toBe("site");
    expect(parseSettingsScope("location")).toBe("location");
  });

  it("returns null for anything else", () => {
    expect(parseSettingsScope(undefined)).toBeNull();
    expect(parseSettingsScope("all")).toBeNull();
    expect(parseSettingsScope([])).toBeNull();
  });
});

describe("parseSettingsLocation", () => {
  const locations = [{ id: LOCATION_ID, name: "Gudang Utara", siteId: SITE_ID }];

  it("keeps a listed location id", () => {
    expect(parseSettingsLocation(LOCATION_ID, locations)).toBe(LOCATION_ID);
    expect(parseSettingsLocation([LOCATION_ID, "x"], locations)).toBe(LOCATION_ID);
  });

  it("returns null for an unlisted or missing id", () => {
    expect(parseSettingsLocation("not-a-uuid", locations)).toBeNull();
    expect(parseSettingsLocation(SITE_ID, locations)).toBeNull();
    expect(parseSettingsLocation(undefined, locations)).toBeNull();
    expect(parseSettingsLocation(LOCATION_ID, [])).toBeNull();
  });
});
