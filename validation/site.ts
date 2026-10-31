import { z } from "zod";

export const siteSchema = z.object({
  name: z
    .string({ error: "Site name is required" })
    .trim()
    .min(1, "Site name is required")
    .max(100, "Site name must be 100 characters or fewer"),
});

export type SiteInput = z.infer<typeof siteSchema>;
