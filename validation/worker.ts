import { z } from "zod";

export const workerSchema = z.object({
  employeeId: z
    .string({ error: "Employee ID is required" })
    .trim()
    .min(1, "Employee ID is required")
    .max(100, "Employee ID must be 100 characters or fewer"),
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  siteId: z.string().uuid("Choose a site"),
  locationId: z.string().uuid("Choose a location"),
  positionIds: z.array(z.string().uuid()).transform((ids) => [...new Set(ids)]),
});

export type WorkerInput = z.input<typeof workerSchema>;
export type WorkerData = z.output<typeof workerSchema>;
