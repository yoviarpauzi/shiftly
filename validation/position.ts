import { z } from "zod";

export const positionSchema = z.object({
  name: z
    .string({ error: "Position name is required" })
    .trim()
    .min(1, "Position name is required")
    .max(100, "Position name must be 100 characters or fewer"),
  siteId: z.string().uuid("Choose a site"),
});

export type PositionInput = z.infer<typeof positionSchema>;

// A position keeps its site after creation, so edit validates the name alone.
export const positionNameSchema = positionSchema.pick({ name: true });

export type PositionNameInput = z.infer<typeof positionNameSchema>;
