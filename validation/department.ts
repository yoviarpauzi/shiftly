import { z } from "zod";

export const departmentSchema = z.object({
  name: z
    .string({ error: "Department name is required" })
    .trim()
    .min(1, "Department name is required")
    .max(100, "Department name must be 100 characters or fewer"),
  locationId: z.string().uuid("Choose a location"),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;

// A department keeps its location after creation, so edit validates the name alone.
export const departmentNameSchema = departmentSchema.pick({ name: true });

export type DepartmentNameInput = z.infer<typeof departmentNameSchema>;
