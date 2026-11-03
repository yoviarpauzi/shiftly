import type { AppRole } from "@/types/roles";

export type WorkDays = 5 | 7;

export type WorkRuleScope = "global" | "site" | "location";

export type WorkRuleValues = {
  workDaysPerWeek: WorkDays;
  breakDays: number;
  breakCycleMonths: number;
  annualOffDays: number;
  shiftExceptionDays: number;
  requirePositionMatch: boolean;
  maxWorkingDaysPerMonth: number;
};

export type WorkRuleKey = keyof WorkRuleValues;

// One stored row: a column is null when that level does not set the rule.
export type WorkRuleRow = { [K in WorkRuleKey]: WorkRuleValues[K] | null };

// Where an effective value came from.
export type WorkRuleSource = "location" | "site" | "global" | "default";

export type PasswordField = "currentPassword" | "newPassword" | "confirmPassword";

export type PasswordActionResult =
  | { ok: true }
  | { ok: false; formError?: string; fieldErrors?: Partial<Record<PasswordField, string>> };

export type WorkRulesActionResult = { ok: true } | { ok: false; formError: string };

// siteId null means every site (superadmin only). locationId is set for admin site only.
export type SettingsAccess = {
  userId: string;
  role: AppRole;
  siteId: string | null;
  locationId: string | null;
};

export type SettingsLocation = { id: string; name: string; siteId: string };

// Admin site gets its own location as fixed text. Superadmin and HO pick one.
export type LocationChoice =
  | { mode: "fixed"; location: SettingsLocation }
  | { mode: "pick"; locations: SettingsLocation[] };

// locationSiteId is the site that owns the location, for location scope.
export type WorkRuleAccessTarget = {
  scope: WorkRuleScope;
  siteId: string | null;
  locationId: string | null;
  locationSiteId: string | null;
};

export type WorkRulesResolved = {
  values: WorkRuleValues;
  sources: Record<WorkRuleKey, WorkRuleSource>;
};

// own[key] is true when the value is set at the chosen scope.
export type LocationWorkRules = {
  scope: WorkRuleScope;
  siteId: string | null;
  siteName: string | null;
  locationId: string | null;
  locationName: string | null;
  resolved: WorkRulesResolved;
  own: Record<WorkRuleKey, boolean>;
};
