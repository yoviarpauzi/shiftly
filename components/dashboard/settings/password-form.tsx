"use client";

import { useForm } from "@tanstack/react-form";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { nameFieldError } from "@/app/dashboard/departments/department-rules";
import { changePassword } from "@/app/dashboard/settings/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import type { PasswordField, PasswordInputProps } from "@/types/settings";
import { changePasswordSchema } from "@/validation/settings";

const PASSWORD_LABELS: Record<PasswordField, string> = {
  currentPassword: "Current password",
  newPassword: "New password",
  confirmPassword: "Confirm password",
};

const PASSWORD_FIELDS = Object.keys(PASSWORD_LABELS) as PasswordField[];

function PasswordInput({
  id,
  name,
  value,
  autoComplete,
  invalid,
  disabled,
  onChange,
  onBlur,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={invalid || undefined}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((shown) => !shown)}
          disabled={disabled}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

export function PasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = changePasswordSchema.safeParse(value);

        if (parsed.success) {
          return undefined;
        }

        const fields: Record<string, { message: string }> = {};

        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0]);
          fields[key] ??= { message: issue.message };
        }

        return { fields };
      },
    },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);

      const result = await changePassword(value);

      if (!result.ok) {
        setFormError(result.formError ?? null);
        formApi.setErrorMap({
          onSubmit: {
            form: result.formError,
            fields: {
              currentPassword: nameFieldError(result.fieldErrors?.currentPassword),
              newPassword: nameFieldError(result.fieldErrors?.newPassword),
              confirmPassword: nameFieldError(result.fieldErrors?.confirmPassword),
            },
          },
        });
        return;
      }

      toast.success("Password updated");
      formApi.reset();
    },
  });

  return (
    <form
      className="flex flex-col gap-5 rounded-lg border bg-card p-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Change password</h2>
        <p className="text-sm text-muted-foreground">
          Enter your current password, then choose a new one of at least 8 characters.
        </p>
      </div>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            <FieldGroup>
              {PASSWORD_FIELDS.map((name) => (
                <form.Field key={name} name={name}>
                  {(field) => {
                    const isInvalid = field.state.meta.errors.length > 0;

                    return (
                      <Field data-invalid={isInvalid || undefined}>
                        <FieldLabel htmlFor={field.name}>{PASSWORD_LABELS[name]}</FieldLabel>
                        <PasswordInput
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          autoComplete={
                            name === "currentPassword" ? "current-password" : "new-password"
                          }
                          invalid={isInvalid}
                          disabled={isSubmitting}
                          onChange={field.handleChange}
                          onBlur={field.handleBlur}
                        />
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </Field>
                    );
                  }}
                </form.Field>
              ))}
            </FieldGroup>
            <p className="text-xs text-muted-foreground">
              Changing the password signs out every other device. This device stays signed in.
            </p>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Spinner data-icon="inline-start" />}
                Update password
              </Button>
            </div>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}
