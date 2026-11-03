"use client";

import { useForm } from "@tanstack/react-form";
import { updateWorkRuleBreak } from "@/app/dashboard/settings/actions";
import { appliesToText, workRuleTargetFor } from "@/app/dashboard/settings/settings-rules";
import { RuleSourceLine } from "@/components/dashboard/settings/rule-source-line";
import {
  useWorkRuleResult,
  WorkRuleCardFooter,
  WorkRuleCardShell,
  WorkRuleNumberField,
} from "@/components/dashboard/settings/work-rule-card-shell";
import type { WorkRuleCardProps } from "@/types/settings";
import { breakRuleSchema, toWholeNumber, workRuleFormErrors } from "@/validation/settings";

// Only the working-days card shows the read-only note, so the level explains itself once.
export function BreakCard({ rules, scope, canEdit }: WorkRuleCardProps) {
  const { formError, setFormError, report, inheriting, inherit } = useWorkRuleResult();
  const target = workRuleTargetFor(rules);
  const toInput = (value: { breakDays: string; breakCycleMonths: string }) => ({
    target,
    breakDays: toWholeNumber(value.breakDays),
    breakCycleMonths: toWholeNumber(value.breakCycleMonths),
  });

  const form = useForm({
    defaultValues: {
      breakDays: String(rules.resolved.values.breakDays),
      breakCycleMonths: String(rules.resolved.values.breakCycleMonths),
    },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = breakRuleSchema.safeParse(toInput(value));

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
      report(await updateWorkRuleBreak(toInput(value)));
    },
  });

  return (
    <WorkRuleCardShell
      title="Break"
      description="How many break days each worker gets, and how often."
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
          {(isSubmitting) => {
            const disabled = !canEdit || isSubmitting || inheriting;

            return (
              <>
                <div className="flex gap-3">
                  <form.Field name="breakDays">
                    {(field) => (
                      <WorkRuleNumberField
                        id={field.name}
                        label="Break days"
                        suffix="days"
                        value={field.state.value}
                        errors={field.state.meta.errors}
                        disabled={disabled}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                      />
                    )}
                  </form.Field>
                  <form.Field name="breakCycleMonths">
                    {(field) => (
                      <WorkRuleNumberField
                        id={field.name}
                        label="Cycle length"
                        suffix="months"
                        value={field.state.value}
                        errors={field.state.meta.errors}
                        disabled={disabled}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                      />
                    )}
                  </form.Field>
                </div>
                <form.Subscribe selector={(state) => state.values}>
                  {(values) => (
                    <p className="rounded-lg bg-secondary px-4 py-3 text-sm">
                      Each worker gets{" "}
                      <span className="font-medium">{values.breakDays.trim()} break days</span>{" "}
                      every {values.breakCycleMonths.trim()} months.
                    </p>
                  )}
                </form.Subscribe>
                <RuleSourceLine
                  ruleKey="breakDays"
                  scope={rules.scope}
                  rules={rules}
                  canEdit={canEdit}
                  pending={isSubmitting || inheriting}
                  onUseInherited={() =>
                    inherit(() =>
                      updateWorkRuleBreak({ target, breakDays: null, breakCycleMonths: null }),
                    )
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
            );
          }}
        </form.Subscribe>
      </form>
    </WorkRuleCardShell>
  );
}
