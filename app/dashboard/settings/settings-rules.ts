import type { SiteChoice } from "@/types/locations";
import type {
  LocationChoice,
  WorkDays,
  WorkRuleKey,
  WorkRuleRow,
  WorkRuleScope,
  WorkRuleSource,
  WorkRuleValues,
  WorkRulesResolved,
} from "@/types/settings";

export const DEFAULT_WORK_DAYS = 5;

// Built-in values used when no level sets a rule.
export const WORK_RULE_DEFAULTS: WorkRuleValues = {
  workDaysPerWeek: DEFAULT_WORK_DAYS,
  breakDays: 4,
  breakCycleMonths: 3,
  annualOffDays: 20,
  shiftExceptionDays: 7,
  requirePositionMatch: true,
  maxWorkingDaysPerMonth: 26,
};

export const SITE_NOT_FOUND_MESSAGE = "Site not found";
export const LOCATION_NOT_FOUND_MESSAGE = "Location not found";
export const READ_ONLY_MESSAGE = "You can view these work rules but not change them";
export const INCORRECT_PASSWORD_MESSAGE = "Current password is incorrect";

const RULE_KEYS = Object.keys(WORK_RULE_DEFAULTS) as WorkRuleKey[];

// Each rule resolves on its own: location, then site, then global, then the default.
// A null column means that level does not set the rule.
export function resolveWorkRules(rows: {
  global: WorkRuleRow | null;
  site: WorkRuleRow | null;
  location: WorkRuleRow | null;
}): WorkRulesResolved {
  const levels: [Exclude<WorkRuleSource, "default">, WorkRuleRow | null][] = [
    ["location", rows.location],
    ["site", rows.site],
    ["global", rows.global],
  ];
  const values: Record<string, unknown> = {};
  const sources: Record<string, WorkRuleSource> = {};

  for (const key of RULE_KEYS) {
    values[key] = WORK_RULE_DEFAULTS[key];
    sources[key] = "default";

    for (const [source, row] of levels) {
      const value = row?.[key] ?? null;

      if (value !== null) {
        values[key] = value;
        sources[key] = source;
        break;
      }
    }
  }

  return {
    values: values as WorkRuleValues,
    sources: sources as Record<WorkRuleKey, WorkRuleSource>,
  };
}

// A worker's own working days win over the resolved rule.
export function effectiveWorkDays(
  workerValue: WorkDays | null,
  resolvedWorkDays: WorkDays,
): WorkDays {
  return workerValue ?? resolvedWorkDays;
}

export function pickSettingsScope(requested: string | null): WorkRuleScope {
  return requested === "global" || requested === "site" || requested === "location"
    ? requested
    : "location";
}

// A fixed choice ignores the request. A pick choice keeps the request when it is listed,
// otherwise the first entry, or null when the list is empty.
export function pickSettingsSite(choice: SiteChoice, requested: string | null): string | null {
  if (choice.mode === "fixed") {
    return choice.site.id;
  }

  if (requested && choice.sites.some((site) => site.id === requested)) {
    return requested;
  }

  return choice.sites[0]?.id ?? null;
}

export function pickSettingsLocation(
  choice: LocationChoice,
  requested: string | null,
): string | null {
  if (choice.mode === "fixed") {
    return choice.location.id;
  }

  if (requested && choice.locations.some((location) => location.id === requested)) {
    return requested;
  }

  return choice.locations[0]?.id ?? null;
}
