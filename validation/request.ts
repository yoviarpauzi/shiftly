import { z } from "zod";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// A regex alone lets 2026-02-30 through, so the parts go through Date.UTC and must come back unchanged.
function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

// minDate is YYYY-MM-DD. Both sides are zero padded, so a string compare is a date compare.
const startDateField = (minDate: string | null) =>
  z
    .string({ error: "Start date is required" })
    .refine(isCalendarDate, "Start date must be a real date like 2026-11-02")
    .refine(
      (value) => minDate === null || !isCalendarDate(value) || value >= minDate,
      "Start date cannot be in the past",
    );

const noteField = z
  .string()
  .trim()
  .max(500, "Note must be 500 characters or fewer")
  .nullish()
  .transform((value) => (value ? value : null));

const lineSchema = z.object({
  departmentId: z.string({ error: "Choose a department" }).uuid("Choose a department"),
  subDepartmentId: z.string().uuid("Choose a sub-department").nullable(),
  positionId: z.string({ error: "Choose a position" }).uuid("Choose a position"),
  headcount: z
    .number({ error: "Headcount is required" })
    .int("Headcount must be a whole number")
    .min(1, "Headcount must be between 1 and 999")
    .max(999, "Headcount must be between 1 and 999"),
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
    note: noteField,
    lines: linesField,
  });

export type RequestUpdateInput = z.infer<ReturnType<typeof updateRequestSchema>>;

export const createRequestSchema = (minDate: string | null) =>
  updateRequestSchema(minDate).extend({
    type: z.enum(["daily", "weekly"], { error: "Choose daily or weekly" }),
    locationId: z.string({ error: "Choose a location" }).uuid("Choose a location"),
  });

export type RequestInput = z.infer<ReturnType<typeof createRequestSchema>>;
