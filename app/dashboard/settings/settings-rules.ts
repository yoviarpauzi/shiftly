import type {
  LocationChoice,
  LocationWorkRules,
  RuleSourceInput,
  SettingsTarget,
  WorkRulesEmpty,
  WorkRuleKey,
  WorkRuleRow,
  WorkRuleScope,
  WorkRuleSource,
  WorkRuleValues,
  WorkRulesResolved,
} from "@/types/settings";
import { toWholeNumber, type WorkRuleTarget } from "@/validation/settings";

export const DEFAULT_WORK_DAYS = 5;

// Built-in values used when no level sets a rule.
export const WORK_RULE_DEFAULTS: WorkRuleValues = {
  workDaysPerWeek: DEFAULT_WORK_DAYS,
  breakDays: 4,
  breakCycleMonths: 3,
  annualOffDays: 20,
  shiftExceptionDays: 7,
  requirePositionMatch: true,
  keepPreviousPlacement: false,
  maxWorkingDaysPerMonth: 26,
};

export const LOCATION_NOT_FOUND_MESSAGE = "Location not found";
export const READ_ONLY_MESSAGE = "You can view these work rules but not change them";
export const INCORRECT_PASSWORD_MESSAGE = "Current password is incorrect";

const RULE_KEYS = Object.keys(WORK_RULE_DEFAULTS) as WorkRuleKey[];

// Each rule resolves on its own: location, then global, then the default.
// A null column means that level does not set the rule, so the global row decides.
export function resolveWorkRules(rows: {
  global: WorkRuleRow | null;
  location: WorkRuleRow | null;
}): WorkRulesResolved {
  const levels: [Exclude<WorkRuleSource, "default">, WorkRuleRow | null][] = [
    ["location", rows.location],
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
export function effectiveWorkDays(workerValue: number | null, resolvedWorkDays: number): number {
  return workerValue ?? resolvedWorkDays;
}

export function pickSettingsScope(requested: string | null): WorkRuleScope {
  return requested === "global" || requested === "location" ? requested : "location";
}

// A fixed choice ignores the request. A pick choice keeps the request when it is listed,
// otherwise the first entry, or null when the list is empty.
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

// No location only blocks the location level: Global still has its cards.
export function workRulesEmptyFor(target: SettingsTarget): WorkRulesEmpty | null {
  return target.scope === "location" && !target.locationId ? "no-location" : null;
}

// The URL of one level of the Work rules section. The location is only kept at location level.
export function settingsHref(target: SettingsTarget): string {
  const params = new URLSearchParams({ scope: target.scope });

  if (target.scope === "location" && target.locationId) {
    params.set("location", target.locationId);
  }

  return `/dashboard/settings?${params.toString()}`;
}

// The React key of one card. The card name keeps the seven cards apart. The level and
// location reset the form when the level changes. Whether the level sets the card's own value
// resets it after a first save or "Use inherited", so it shows the value that now applies.
export function workRuleCardKey(
  card: WorkRuleKey,
  rules: Pick<LocationWorkRules, "scope" | "locationId" | "own">,
): string {
  return `${card}-${rules.scope}-${rules.locationId}-${rules.own[card]}`;
}

// The number a card summary shows, or null while the field holds text that is not a whole
// number, so the summary never echoes invalid input.
export function summaryNumber(text: string): number | null {
  const value = toWholeNumber(text);

  return Number.isFinite(value) ? value : null;
}

// "1 break day", "4 break days": the noun takes an "s" for every count but one.
export function countText(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// The action input for the level a card was loaded for.
export function workRuleTargetFor(
  rules: Pick<LocationWorkRules, "scope" | "locationId">,
): WorkRuleTarget {
  if (rules.scope === "location") {
    return { scope: "location", locationId: rules.locationId ?? "" };
  }

  return { scope: "global" };
}

// The line under a card's fields that says where its value comes from. The built-in default
// counts as global, since the global level is where it is changed.
export function ruleSourceText({ scope, source, own }: RuleSourceInput): string {
  if (scope === "global") {
    return "Applies to every location that does not set its own.";
  }

  return own || source === "location" ? "Set for this location" : "Inherited from global";
}

const WORKER_OWN_SETTING =
  "A worker's own setting, chosen in the Worker menu, takes priority.";

export function workDaysDescription(scope: WorkRuleScope): string {
  const lead = {
    global: "Default for workers in every location that does not set its own.",
    location: "Default for workers in this location.",
  }[scope];

  return `${lead} ${WORKER_OWN_SETTING}`;
}

export function appliesToText(scope: WorkRuleScope): string {
  return {
    global: "Applies to all workers in every location unless a location sets its own.",
    location: "Applies to all workers in this location.",
  }[scope];
}

// Shown on a level the user can view but not change. Every user who sees a location can change
// it, so the location level has no note.
export function readOnlyNoteFor(scope: WorkRuleScope): string | null {
  return scope === "global" ? "Only HO can change global rules." : null;
}
