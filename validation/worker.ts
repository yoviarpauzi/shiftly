import { z } from "zod";
import { isCalendarDate } from "./calendar-date";

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
  // abort stops a blank value from also getting the date message.
  endContract: z
    .string({ error: "End of contract is required" })
    .trim()
    .min(1, { error: "End of contract is required", abort: true })
    .refine(isCalendarDate, "End of contract must be a real date like 2026-12-31"),
});

export type WorkerInput = z.input<typeof workerSchema>;
export type WorkerData = z.output<typeof workerSchema>;
