import { z } from "zod";

export const signInSchema = z.object({
  email: z
    .string({ error: "Email is required" })
    .trim()
    .min(1, "Email is required")
    .pipe(z.email("Enter a valid email address")),
  password: z
    .string({ error: "Password is required" })
    .min(1, "Password is required"),
});

export type SignInInput = z.infer<typeof signInSchema>;
