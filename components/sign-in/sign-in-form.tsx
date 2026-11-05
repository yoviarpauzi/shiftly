"use client";

import { cn } from "cn";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { signInSchema } from "@/validation/sign-in";

export function SignInForm({ className }: { className?: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);

      const { error } = await authClient.signIn.email({
        email: value.email.trim(),
        password: value.password,
      });

      if (error) {
        setServerError(error.message ?? "Sign in failed. Please try again.");
        return;
      }

      router.push("/dashboard");
    },
  });

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <FieldGroup>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Sign in to Shiftly
              </h1>
              <p className="text-base text-muted-foreground">
                Enter your email and password to continue
              </p>
            </div>
            <form.Field name="email">
              {(field) => {
                const isInvalid =
                  field.state.meta.errors.length > 0 || serverError !== null;

                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="email"
                      autoComplete="email"
                      placeholder="name@company.com"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      required
                      disabled={isSubmitting}
                      aria-invalid={isInvalid || undefined}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>
            <form.Field name="password">
              {(field) => {
                const isInvalid =
                  field.state.meta.errors.length > 0 || serverError !== null;
                const passwordErrors =
                  field.state.meta.errors.length > 0
                    ? field.state.meta.errors
                    : serverError
                      ? [{ message: serverError }]
                      : [];

                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id={field.name}
                        name={field.name}
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder="••••••••"
                        required
                        disabled={isSubmitting}
                        aria-invalid={isInvalid || undefined}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          type="button"
                          size="icon-xs"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          aria-pressed={showPassword}
                          disabled={isSubmitting}
                          onClick={() => setShowPassword((current) => !current)}
                        >
                          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                    {passwordErrors.length > 0 && (
                      <FieldError errors={passwordErrors} />
                    )}
                  </Field>
                );
              }}
            </form.Field>
            <Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Spinner data-icon="inline-start" />}
                Sign in
              </Button>
            </Field>
            <p className="text-center text-sm text-muted-foreground">
              Forgot your password? Contact HO or shiftly admin.
            </p>
          </FieldGroup>
        )}
      </form.Subscribe>
    </form>
  );
}
