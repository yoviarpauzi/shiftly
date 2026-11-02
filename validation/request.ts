import { z } from "zod";

import { isCalendarDate } from "./calendar-date";

export const START_DATE_PAST_MESSAGE = "Start date cannot be in the past";

// minDate is YYYY-MM-DD. Both sides are zero padded, so a string compare is a date compare.
const startDateField = (minDate: string | null) =>
  z
    .string({ error: "Start date is required" })
    .refine(isCalendarDate, "Start date must be a real date like 2026-11-02")
    .refine(
      (value) => minDate === null || !isCalendarDate(value) || value >= minDate,
      START_DATE_PAST_MESSAGE,
    );

// One number for a daily line, seven for a weekly one. Which length the type needs, and the daily
// minimum of 1, are checked by headcountsError, because this schema does not see the type.
const HEADCOUNT_LENGTHS = [1, 7];

// z.number refuses NaN, so an empty form field reports "Headcount is required".
const headcountField = z
  .number({ error: "Headcount is required" })
  .int("Headcount must be a whole number")
  .min(0, "Headcount must be between 0 and 999")
  .max(999, "Headcount must be between 0 and 999");

const lineSchema = z.object({
  departmentId: z.string({ error: "Choose a department" }).uuid("Choose a department"),
  subDepartmentId: z.string().uuid("Choose a sub-department").nullable(),
  positionId: z.string({ error: "Choose a position" }).uuid("Choose a position"),
  headcounts: z
    .array(headcountField, { error: "Headcount is required" })
    .refine(
      (headcounts) => HEADCOUNT_LENGTHS.includes(headcounts.length),
      "Headcount does not match the request type",
    ),
});

const linesField = z
  .array(lineSchema, { error: "Add at least one line" })
  .min(1, "Add at least one line")
  .max(50, "A request can have at most 50 lines")
  .superRefine((lines, ctx) => {
    const seen = new Set<string>();

    for (const line of lines) {
      const key = JSON.stringify([line.departmentId, line.subDepartmentId, line.positionId]);

      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          message: "Two lines have the same department, sub-department, and position",
        });
        return;
      }
      seen.add(key);
    }
  });

// The reason HO gives when rejecting a request. Matches the server's check in rejectRequest.
export const rejectReasonSchema = z
  .string({ error: "Enter a reason of up to 500 characters" })
  .trim()
  .min(1, "Enter a reason of up to 500 characters")
  .max(500, "Enter a reason of up to 500 characters");

// minDate is the earliest allowed start date as YYYY-MM-DD. null skips the date rule.
export const updateRequestSchema = (minDate: string | null) =>
  z.object({
    startDate: startDateField(minDate),
    lines: linesField,
  });

export type RequestUpdateInput = z.infer<ReturnType<typeof updateRequestSchema>>;

export const createRequestSchema = (minDate: string | null) =>
  updateRequestSchema(minDate).extend({
    type: z.enum(["daily", "weekly"], { error: "Choose daily or weekly" }),
    locationId: z.string({ error: "Choose a location" }).uuid("Choose a location"),
  });

export type RequestInput = z.infer<ReturnType<typeof createRequestSchema>>;
