import { z } from "zod";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const timeField = (label: string) =>
  z.string({ error: `${label} is required` }).regex(TIME_PATTERN, `${label} must be a time like 06:00`);

// Kept apart from the refinements so shiftSchema can extend it. zod 4 rejects .pick() on a refined object.
const shiftFieldsSchema = z.object({
  number: z
    .number({ error: "Shift number is required" })
    .int("Shift number must be a whole number")
    .min(1, "Shift number must be between 1 and 9")
    .max(9, "Shift number must be between 1 and 9"),
  name: z
    .string({ error: "Shift name is required" })
    .trim()
    .min(1, "Shift name is required")
    .max(100, "Shift name must be 100 characters or fewer"),
  startTime: timeField("Start time"),
  endTime: timeField("End time"),
});

// A shift that ends earlier than it starts crosses midnight, so only an equal pair is rejected.
const endDiffersFromStart = {
  check: (value: { startTime: string; endTime: string }) => value.startTime !== value.endTime,
  params: {
    message: "End time must differ from start time",
    path: ["endTime"],
  },
};

export const shiftUpdateSchema = shiftFieldsSchema.refine(
  endDiffersFromStart.check,
  endDiffersFromStart.params,
);

export type ShiftUpdateInput = z.infer<typeof shiftUpdateSchema>;

export const shiftSchema = shiftFieldsSchema
  .extend({ siteId: z.string().uuid("Choose a site") })
  .refine(endDiffersFromStart.check, endDiffersFromStart.params);

export type ShiftInput = z.infer<typeof shiftSchema>;
