import { z } from "zod";

export const locationSchema = z.object({
  name: z
    .string({ error: "Location name is required" })
    .trim()
    .min(1, "Location name is required")
    .max(100, "Location name must be 100 characters or fewer"),
  siteId: z.string().uuid("Choose a site"),
});

export type LocationInput = z.infer<typeof locationSchema>;
