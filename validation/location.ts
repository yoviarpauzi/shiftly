import { z } from "zod";

export const locationTimezoneSchema = z.enum(
  ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"],
  { error: "Choose a time zone" },
);

export type LocationTimezone = z.infer<typeof locationTimezoneSchema>;

// Ordered west to east. Jakarta is first: its calendar date is never ahead of another zone's.
export const LOCATION_TIMEZONES = locationTimezoneSchema.options;

export const DEFAULT_LOCATION_TIMEZONE: LocationTimezone = "Asia/Jakarta";

export const locationSchema = z.object({
  name: z
    .string({ error: "Location name is required" })
    .trim()
    .min(1, "Location name is required")
    .max(100, "Location name must be 100 characters or fewer"),
  siteId: z.string().uuid("Choose a site"),
  timezone: locationTimezoneSchema,
});

export type LocationInput = z.infer<typeof locationSchema>;
