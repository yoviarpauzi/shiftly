import { z } from "zod";
import type { Scope } from "@/types/users";

const roleSchema = z.enum(["superadmin", "ho", "admin_site"], { error: "Choose a role" });

const passwordSchema = z
  .string({ error: "Password must be at least 8 characters" })
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or fewer");

const baseFields = z.object({
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  email: z
    .string({ error: "Enter a valid email address" })
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address")),
  role: roleSchema,
  siteId: z.string({ error: "Choose a site" }).uuid("Choose a site").nullable(),
  locationId: z.string({ error: "Choose a location" }).uuid("Choose a location").nullable(),
});

// ho needs a site and no location, admin_site the reverse, superadmin neither.
const checkScope = ({ role, siteId, locationId }: Scope, ctx: z.RefinementCtx) => {
  const needsSite = role === "ho";
  const needsLocation = role === "admin_site";

  if (needsSite && !siteId) {
    ctx.addIssue({ code: "custom", path: ["siteId"], message: "Choose a site" });
  }
  if (!needsSite && siteId) {
    ctx.addIssue({ code: "custom", path: ["siteId"], message: "This role has no site" });
  }
  if (needsLocation && !locationId) {
    ctx.addIssue({ code: "custom", path: ["locationId"], message: "Choose a location" });
  }
  if (!needsLocation && locationId) {
    ctx.addIssue({ code: "custom", path: ["locationId"], message: "This role has no location" });
  }
};

export const createUserSchema = baseFields
  .extend({ password: passwordSchema })
  .superRefine(checkScope);

export type CreateUserInput = z.infer<typeof createUserSchema>;

// An empty password means keep the current one.
export const updateUserSchema = baseFields
  .extend({
    password: z
      .string()
      .optional()
      .transform((value) => (value === "" ? undefined : value))
      .pipe(passwordSchema.optional()),
  })
  .superRefine(checkScope);

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
