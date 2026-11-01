import { z } from "zod";

export const subDepartmentSchema = z.object({
  name: z
    .string({ error: "Sub-department name is required" })
    .trim()
    .min(1, "Sub-department name is required")
    .max(100, "Sub-department name must be 100 characters or fewer"),
});

export type SubDepartmentInput = z.infer<typeof subDepartmentSchema>;
