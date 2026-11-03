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
