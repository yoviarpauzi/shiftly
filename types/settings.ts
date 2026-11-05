import type { ReactNode } from "react";
import type { ZodType } from "zod";
import type { SiteChoice } from "@/types/locations";
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

// The level the Work rules section shows, as read from the URL after the access checks.
export type SettingsTarget = {
  scope: WorkRuleScope;
  siteId: string | null;
  locationId: string | null;
};

export type RuleSourceInput = {
  scope: WorkRuleScope;
  source: WorkRuleSource;
  own: boolean;
  siteName: string | null;
};

export type WorkRulesEmpty = "no-site" | "no-location";

export type SettingsSearchParams = Record<string, string | string[] | undefined>;

// The role-scoped choice lists, passed in so the target can be resolved without a database.
export type SettingsTargetLoaders = {
  siteChoiceFor: (access: SettingsAccess) => Promise<SiteChoice>;
  locationChoiceFor: (access: SettingsAccess, siteId: string) => Promise<LocationChoice>;
};

// load is the level to read with workRulesFor, or null when empty says why there is none.
export type ResolvedSettingsTarget = {
  scope: WorkRuleScope;
  siteChoice: SiteChoice;
  siteId: string | null;
  locationChoice: LocationChoice | null;
  locationId: string | null;
  empty: WorkRulesEmpty | null;
  load: SettingsTarget | null;
};

// canEdit comes from canEditWorkRule for the chosen target.
export type WorkRulesView = {
  scope: WorkRuleScope;
  siteChoice: SiteChoice;
  siteId: string | null;
  locationChoice: LocationChoice | null;
  rules: LocationWorkRules | null;
  canEdit: boolean;
  empty: WorkRulesEmpty | null;
};

export type WorkRulesProps = WorkRulesView;

// siteId is the chosen site. It is kept apart from rules.siteId, which is null at global scope,
// so switching from Global back to Site or Location stays on the same site.
export type WorkRulesScope = {
  scope: WorkRuleScope;
  siteChoice: SiteChoice;
  locationChoice: LocationChoice | null;
  siteId: string | null;
};

export type WorkRuleCardProps = {
  rules: LocationWorkRules;
  scope: WorkRulesScope;
  canEdit: boolean;
  readOnlyNote: string | null;
};

// noLocation shows only the scope control and, for a superadmin, the Site select.
export type WorkRulesScopeFieldsProps = WorkRulesScope & {
  locationId: string | null;
  noLocation?: boolean;
};

export type RuleSourceLineProps = {
  ruleKey: WorkRuleKey;
  scope: WorkRuleScope;
  rules: LocationWorkRules;
  canEdit: boolean;
  pending: boolean;
  onUseInherited: () => void;
};

export type WorkRuleCardShellProps = {
  title: string;
  description: string;
  scope: WorkRulesScope;
  rules: LocationWorkRules;
  children: ReactNode;
};

export type WorkRuleNumberFieldProps = {
  id: string;
  label: string;
  suffix: string;
  value: string;
  errors: Array<{ message?: string } | undefined>;
  disabled: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
};

// The plumbing every card shares. toInput turns the form values (numbers kept as text) into the
// action input, so the schema check and the save see the same input. TInput is read from the
// action, so "Use inherited" may pass null.
export type WorkRuleFormOptions<TValues, TInput> = {
  defaultValues: TValues;
  schema: ZodType;
  toInput: (values: TValues) => NoInfer<TInput>;
  action: (input: TInput) => Promise<WorkRulesActionResult>;
};

export type WorkRuleFormProps = { onSubmit: () => void; children: ReactNode };

export type WorkRuleCardFooterProps = {
  helper: string;
  readOnlyNote: string | null;
  formError: string | null;
  canEdit: boolean;
  pending: boolean;
};

export type PasswordInputProps = {
  id: string;
  name: string;
  value: string;
  autoComplete: "current-password" | "new-password";
  invalid: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
};

export type WorkRulesEmptyStateProps = { empty: WorkRulesEmpty };
