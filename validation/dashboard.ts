import { z } from "zod";

export const dashboardRowSchema = z.object({
  id: z.number(),
  header: z.string(),
  type: z.string(),
  status: z.string(),
  target: z.string(),
  limit: z.string(),
  reviewer: z.string(),
});

export type DashboardRow = z.infer<typeof dashboardRowSchema>;
