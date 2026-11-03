import { z } from "zod";
import type { WorkRuleKey } from "@/types/settings";

export const WORK_DAYS = [5, 7] as const;

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
