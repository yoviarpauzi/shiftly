import { z } from "zod";

export const positionSchema = z.object({
  name: z
    .string({ error: "Position name is required" })
    .trim()
    .min(1, "Position name is required")
    .max(100, "Position name must be 100 characters or fewer"),
});

export type PositionInput = z.infer<typeof positionSchema>;
