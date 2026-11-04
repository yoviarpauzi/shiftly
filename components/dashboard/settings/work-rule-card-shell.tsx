"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { WorkRulesScopeFields } from "@/components/dashboard/settings/work-rules-scope-fields";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import type {
  WorkRuleCardFooterProps,
  WorkRuleCardShellProps,
  WorkRuleFormOptions,
  WorkRuleFormProps,
  WorkRuleNumberFieldProps,
  WorkRulesActionResult,
} from "@/types/settings";
import { workRuleFormErrors } from "@/validation/settings";

// The frame every work-rule card shares: title, description, and the level picker.
export function WorkRuleCardShell({
  title,
  description,
  scope,
  rules,
  children,
}: WorkRuleCardShellProps) {
  return (
    <section className="flex flex-col gap-5 rounded-lg border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <WorkRulesScopeFields {...scope} locationId={rules.locationId} />
      {children}
    </section>
  );
}

// The form plumbing every card shares: the zod check on submit, the save, "Use inherited",
// and the result handling. Each card only supplies its values, schema, input builder, action.
// A target issue has no field to show it, so it comes back as the form-level error.
export function useWorkRuleForm<TValues, TInput>({
  defaultValues,
  schema,
  toInput,
  action,
}: WorkRuleFormOptions<TValues, TInput>) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [inheriting, startInherit] = useTransition();

  const report = (result: WorkRulesActionResult) => {
    if (!result.ok) {
      setActionError(result.formError);
      return;
    }

    setActionError(null);
    toast.success("Work rules updated");
  };

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: ({ value }) => {
        const parsed = schema.safeParse(toInput(value));

        return parsed.success ? undefined : workRuleFormErrors(parsed.error.issues);
      },
    },
    onSubmit: async ({ value }) => {
      setActionError(null);
      report(await action(toInput(value)));
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const validationError = useStore(
    form.store,
    (state) => state.errors.find((error) => typeof error === "string") ?? null,
  );

  const inheritWith = (input: TInput) => {
    startInherit(async () => {
      setActionError(null);
      report(await action(input));
    });
  };

  return {
    form,
    pending: isSubmitting || inheriting,
    formError: actionError ?? validationError,
    inheritWith,
  };
}

export function WorkRuleForm({ onSubmit, children }: WorkRuleFormProps) {
  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

// A whole-number input with its unit inside the box. The value stays text until submit.
export function WorkRuleNumberField({
  id,
  label,
  suffix,
  value,
  errors,
  disabled,
  onChange,
  onBlur,
}: WorkRuleNumberFieldProps) {
  const isInvalid = errors.length > 0;

  return (
    <Field data-invalid={isInvalid || undefined} className="min-w-0 flex-1">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          name={id}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-invalid={isInvalid || undefined}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText className="font-normal">{suffix}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
      {isInvalid && <FieldError errors={errors} />}
    </Field>
  );
}

// Helper text, the read-only note, the action error, and Save, which only an editor sees.
export function WorkRuleCardFooter({
  helper,
  readOnlyNote,
  formError,
  canEdit,
  pending,
}: WorkRuleCardFooterProps) {
  return (
    <>
      <p className="text-xs text-muted-foreground">{helper}</p>
      {readOnlyNote && (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm">{readOnlyNote}</p>
      )}
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Save
          </Button>
        </div>
      )}
    </>
  );
}
