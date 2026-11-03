"use client";

import { useForm } from "@tanstack/react-form";
import { updateWorkRuleAnnualOff } from "@/app/dashboard/settings/actions";
import { appliesToText, workRuleTargetFor } from "@/app/dashboard/settings/settings-rules";
import { RuleSourceLine } from "@/components/dashboard/settings/rule-source-line";
import {
  useWorkRuleResult,
  WorkRuleCardFooter,
  WorkRuleCardShell,
  WorkRuleNumberField,
} from "@/components/dashboard/settings/work-rule-card-shell";
import type { WorkRuleCardProps } from "@/types/settings";
import { annualOffRuleSchema, toWholeNumber, workRuleFormErrors } from "@/validation/settings";

export function AnnualOffCard({ rules, scope, canEdit }: WorkRuleCardProps) {
  const { formError, setFormError, report, inheriting, inherit } = useWorkRuleResult();
  const target = workRuleTargetFor(rules);
  const toInput = (value: { annualOffDays: string }) => ({
    target,
    annualOffDays: toWholeNumber(value.annualOffDays),
  });

  const form = useForm({
    defaultValues: { annualOffDays: String(rules.resolved.values.annualOffDays) },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = annualOffRuleSchema.safeParse(toInput(value));

        if (parsed.success) {
          return undefined;
        }

        const errors = workRuleFormErrors(parsed.error.issues);
        setFormError(errors.form ?? null);

        return errors;
      },
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      report(await updateWorkRuleAnnualOff(toInput(value)));
    },
  });

  return (
    <WorkRuleCardShell
      title="Annual off"
      description="How many off days each worker gets per year."
      scope={scope}
      rules={rules}
    >
      <form
        className="flex flex-col gap-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <>
              <form.Field name="annualOffDays">
                {(field) => (
                  <WorkRuleNumberField
                    id={field.name}
                    label="Off days per year"
                    suffix="days"
                    value={field.state.value}
                    errors={field.state.meta.errors}
                    disabled={!canEdit || isSubmitting || inheriting}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.values.annualOffDays}>
                {(annualOffDays) => (
                  <p className="rounded-lg bg-secondary px-4 py-3 text-sm">
                    Each worker gets{" "}
                    <span className="font-medium">{annualOffDays.trim()} off days</span> per year.
                  </p>
                )}
              </form.Subscribe>
              <RuleSourceLine
                ruleKey="annualOffDays"
                scope={rules.scope}
                rules={rules}
                canEdit={canEdit}
                pending={isSubmitting || inheriting}
                onUseInherited={() =>
                  inherit(() => updateWorkRuleAnnualOff({ target, annualOffDays: null }))
                }
              />
              <WorkRuleCardFooter
                helper={appliesToText(rules.scope)}
                readOnlyNote={null}
                formError={formError}
                canEdit={canEdit}
                pending={isSubmitting || inheriting}
              />
            </>
          )}
        </form.Subscribe>
      </form>
    </WorkRuleCardShell>
  );
}
