"use client";

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
  WorkRuleNumberFieldProps,
  WorkRulesActionResult,
} from "@/types/settings";

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

// The result handling every card shares, for Save and for "Use inherited".
export function useWorkRuleResult() {
  const [formError, setFormError] = useState<string | null>(null);
  const [inheriting, startInherit] = useTransition();

  const report = (result: WorkRulesActionResult) => {
    if (!result.ok) {
      setFormError(result.formError);
      return;
    }

    setFormError(null);
    toast.success("Work rules updated");
  };

  const inherit = (run: () => Promise<WorkRulesActionResult>) => {
    startInherit(async () => {
      setFormError(null);
      report(await run());
    });
  };

  return { formError, setFormError, report, inheriting, inherit };
}
