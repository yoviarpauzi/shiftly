import { z } from "zod";

const CODE_MESSAGE = "Code must be 2 to 6 letters or digits";

export const siteSchema = z.object({
  name: z
    .string({ error: "Site name is required" })
    .trim()
    .min(1, "Site name is required")
    .max(100, "Site name must be 100 characters or fewer"),
  code: z
    .string({ error: CODE_MESSAGE })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,6}$/, CODE_MESSAGE),
});

export type SiteInput = z.infer<typeof siteSchema>;
