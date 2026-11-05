import { z } from "zod";
import type {
  SettingsLocation,
  WorkRuleKey,
  WorkRuleScope,
} from "@/types/settings";

export const WORK_DAYS = [5, 7] as const;

// database/schema/work-rule-schema.ts imports this file by a relative path, and drizzle-kit does
// not resolve the @/ alias for value imports, so this file must never import a value through @/.
export const WORK_RULE_LIMITS = {
  breakDays: { min: 1, max: 31 },
  breakCycleMonths: { min: 1, max: 12 },
  annualOffDays: { min: 0, max: 366 },
  shiftExceptionDays: { min: 1, max: 30 },
  maxWorkingDaysPerMonth: { min: 1, max: 31 },
} as const;

const passwordSchema = z
  .string({ error: "Password must be at least 8 characters" })
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or fewer");

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: "Current password is required" })
      .min(1, "Current password is required")
      .max(128, "Password must be 128 characters or fewer"),
    newPassword: passwordSchema,
    confirmPassword: z.string({ error: "Passwords do not match" }),
  })
  .superRefine(({ currentPassword, newPassword, confirmPassword }, ctx) => {
    if (confirmPassword !== newPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
    }
    if (newPassword === currentPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "New password must be different from the current one",
      });
    }
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const workRuleTargetSchema = z.discriminatedUnion("scope", [
  z.strictObject({ scope: z.literal("global") }),
  z.strictObject({
    scope: z.literal("site"),
    siteId: z.string({ error: "Choose a site" }).uuid("Choose a site"),
  }),
  z.strictObject({
    scope: z.literal("location"),
    locationId: z.string({ error: "Choose a location" }).uuid("Choose a location"),
  }),
]);

export type WorkRuleTarget = z.infer<typeof workRuleTargetSchema>;

const wholeNumber = ({ min, max }: { min: number; max: number }) =>
  z
    .number({ error: "Enter a whole number" })
    .int("Enter a whole number")
    .min(min, `Enter a number from ${min} to ${max}`)
    .max(max, `Enter a number from ${min} to ${max}`)
    .nullable();

const workDaysField = z
  .union([z.literal(5), z.literal(7)], { error: "Choose 5 or 7 days" })
  .nullable();

const onOffField = z.boolean({ error: "Choose on or off" }).nullable();

// Null means "Use inherited", which has nothing to inherit from at global scope.
const refuseNullAtGlobal =
  (messages: Partial<Record<WorkRuleKey, string>>) =>
  (value: { target: WorkRuleTarget } & Record<string, unknown>, ctx: z.RefinementCtx) => {
    if (value.target.scope !== "global") return;
    for (const [key, message] of Object.entries(messages)) {
      if (value[key] === null) {
        ctx.addIssue({ code: "custom", path: [key], message });
      }
    }
  };

const numberMessage = (key: keyof typeof WORK_RULE_LIMITS) =>
  `Enter a number from ${WORK_RULE_LIMITS[key].min} to ${WORK_RULE_LIMITS[key].max}`;

export const workDaysRuleSchema = z
  .object({ target: workRuleTargetSchema, workDaysPerWeek: workDaysField })
  .superRefine(refuseNullAtGlobal({ workDaysPerWeek: "Choose 5 or 7 days" }));

export type WorkDaysRuleInput = z.infer<typeof workDaysRuleSchema>;

export const breakRuleSchema = z
  .object({
    target: workRuleTargetSchema,
    breakDays: wholeNumber(WORK_RULE_LIMITS.breakDays),
    breakCycleMonths: wholeNumber(WORK_RULE_LIMITS.breakCycleMonths),
  })
  .superRefine(
    refuseNullAtGlobal({
      breakDays: numberMessage("breakDays"),
      breakCycleMonths: numberMessage("breakCycleMonths"),
    }),
  );

export type BreakRuleInput = z.infer<typeof breakRuleSchema>;

export const annualOffRuleSchema = z
  .object({
    target: workRuleTargetSchema,
    annualOffDays: wholeNumber(WORK_RULE_LIMITS.annualOffDays),
  })
  .superRefine(refuseNullAtGlobal({ annualOffDays: numberMessage("annualOffDays") }));

export type AnnualOffRuleInput = z.infer<typeof annualOffRuleSchema>;

export const shiftChangeRuleSchema = z
  .object({
    target: workRuleTargetSchema,
    shiftExceptionDays: wholeNumber(WORK_RULE_LIMITS.shiftExceptionDays),
  })
  .superRefine(refuseNullAtGlobal({ shiftExceptionDays: numberMessage("shiftExceptionDays") }));

export type ShiftChangeRuleInput = z.infer<typeof shiftChangeRuleSchema>;

export const qualificationRuleSchema = z
  .object({ target: workRuleTargetSchema, requirePositionMatch: onOffField })
  .superRefine(refuseNullAtGlobal({ requirePositionMatch: "Choose on or off" }));

export type QualificationRuleInput = z.infer<typeof qualificationRuleSchema>;

export const maxWorkingDaysRuleSchema = z
  .object({
    target: workRuleTargetSchema,
    maxWorkingDaysPerMonth: wholeNumber(WORK_RULE_LIMITS.maxWorkingDaysPerMonth),
  })
  .superRefine(
    refuseNullAtGlobal({ maxWorkingDaysPerMonth: numberMessage("maxWorkingDaysPerMonth") }),
  );

export type MaxWorkingDaysRuleInput = z.infer<typeof maxWorkingDaysRuleSchema>;

// The card forms keep numbers as text. Blank or non-integer text becomes NaN, which the schemas
// reject with "Enter a whole number".
export function toWholeNumber(text: string): number {
  const trimmed = text.trim();

  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

// TanStack Form errors for a failed parse: the first message of each field, and the first
// target issue (which no field shows) as the form error.
export function workRuleFormErrors(
  issues: { path: PropertyKey[]; message: string }[],
): { form?: string; fields: Record<string, { message: string }> } {
  const fields: Record<string, { message: string }> = {};
  let form: string | undefined;

  for (const issue of issues) {
    const key = String(issue.path[0]);

    if (key === "target") {
      form ??= issue.message;
    } else {
      fields[key] ??= { message: issue.message };
    }
  }

  return { form, fields };
}

const SETTINGS_SCOPES: readonly WorkRuleScope[] = ["global", "site", "location"];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Reads ?scope=. Anything else is null, and pickSettingsScope then falls back to location.
export function parseSettingsScope(value: string | string[] | undefined): WorkRuleScope | null {
  const first = firstParam(value);

  return SETTINGS_SCOPES.find((scope) => scope === first) ?? null;
}

// Reads ?location=. Only ids from the caller's own location list count.
export function parseSettingsLocation(
  value: string | string[] | undefined,
  locations: SettingsLocation[],
): string | null {
  const first = firstParam(value);

  return locations.some((location) => location.id === first) ? (first as string) : null;
}
