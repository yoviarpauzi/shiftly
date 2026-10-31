"use client";

import { cn } from "cn";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

export function SignInForm({ className }: { className?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const invalid = error !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const { error: signInError } = await authClient.signIn.email({
      email: String(formData.get("email")),
      password: String(formData.get("password")),
    });

    if (signInError) {
      setError(signInError.message ?? "Sign in failed. Please try again.");
      setIsSubmitting(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
    >
      <FieldGroup>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Sign in to Shiftly</h1>
          <p className="text-base text-muted-foreground">
            Enter your email and password to continue
          </p>
        </div>
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            required
            disabled={isSubmitting}
            aria-invalid={invalid || undefined}
          />
        </Field>
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={isSubmitting}
            aria-invalid={invalid || undefined}
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>
        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            Sign in
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
