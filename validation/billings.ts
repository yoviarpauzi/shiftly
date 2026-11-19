import { z } from "zod";

import { periodFor } from "@/app/dashboard/billings/billing-period";
import type { BillingMode, BillingStatus, BillingStatusFilter } from "@/types/billings";

export const BILLING_MODES = ["monthly", "weekly", "custom"] as const satisfies readonly BillingMode[];

export const BILLING_STATUSES = [
  "draft",
  "issued",
  "void",
] as const satisfies readonly BillingStatus[];

export const VOID_REASON_MAX_LENGTH = 200;

const PERIOD_MESSAGE = "Choose a valid period";

// The fields are plain strings so a bad date reaches the refine below and gets one message.
const periodShapes = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("monthly"), month: z.string({ error: PERIOD_MESSAGE }) }),
  z.object({ mode: z.literal("weekly"), date: z.string({ error: PERIOD_MESSAGE }) }),
  z.object({
    mode: z.literal("custom"),
    from: z.string({ error: PERIOD_MESSAGE }),
    to: z.string({ error: PERIOD_MESSAGE }),
  }),
]);

export const billingPeriodSchema = periodShapes.refine((period) => periodFor(period) !== null, {
  message: PERIOD_MESSAGE,
  path: [],
});

const billingIdField = z.string({ error: "Choose a billing" }).uuid("Choose a billing");
const versionField = z
  .string({ error: "The billing version is missing" })
  .min(1, "The billing version is missing");

export const createBillingSchema = z.object({
  locationId: z.string({ error: "Choose a location" }).uuid("Choose a location"),
  period: billingPeriodSchema,
});

export type CreateBillingInput = z.infer<typeof createBillingSchema>;

export const updateBillingPeriodSchema = z.object({
  billingId: billingIdField,
  version: versionField,
  period: billingPeriodSchema,
});

export type UpdateBillingPeriodInput = z.infer<typeof updateBillingPeriodSchema>;

export const issueBillingSchema = z.object({
  billingId: billingIdField,
  version: versionField,
});

export type IssueBillingInput = z.infer<typeof issueBillingSchema>;

export const voidBillingSchema = z.object({
  billingId: billingIdField,
  version: versionField,
  reason: z
    .string({ error: "A reason is required to void" })
    .trim()
    .min(1, "A reason is required to void")
    .max(VOID_REASON_MAX_LENGTH, `Reason must be ${VOID_REASON_MAX_LENGTH} characters or fewer`),
});

export type VoidBillingInput = z.infer<typeof voidBillingSchema>;

export const deleteBillingSchema = z.object({ billingId: billingIdField });

export type DeleteBillingInput = z.infer<typeof deleteBillingSchema>;

// A malformed id is refused here, before any query.
export function parseBillingId(value: string): string | null {
  return z.string().uuid().safeParse(value).success ? value : null;
}

// Reads the status filter from the URL. Anything missing or unknown shows every status.
export function parseBillingStatus(value: string | string[] | undefined): BillingStatusFilter {
  const first = Array.isArray(value) ? value[0] : value;

  return (BILLING_STATUSES as readonly string[]).includes(first ?? "")
    ? (first as BillingStatus)
    : "all";
}
