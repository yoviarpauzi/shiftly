"use client";

import { updateWorkRuleAnnualOff } from "@/app/dashboard/settings/actions";
import {
  appliesToText,
  summaryNumber,
  workRuleTargetFor,
} from "@/app/dashboard/settings/settings-rules";
import { RuleSourceLine } from "@/components/dashboard/settings/rule-source-line";
import {
  useWorkRuleForm,
  WorkRuleCardFooter,
  WorkRuleCardShell,
  WorkRuleForm,
  WorkRuleNumberField,
} from "@/components/dashboard/settings/work-rule-card-shell";
import type { WorkRuleCardProps } from "@/types/settings";
import { annualOffRuleSchema, toWholeNumber } from "@/validation/settings";

export function AnnualOffCard({ rules, scope, canEdit }: WorkRuleCardProps) {
  const target = workRuleTargetFor(rules);
  const { form, pending, formError, inheritWith } = useWorkRuleForm({
    defaultValues: { annualOffDays: String(rules.resolved.values.annualOffDays) },
    schema: annualOffRuleSchema,
    toInput: (value) => ({ target, annualOffDays: toWholeNumber(value.annualOffDays) }),
    action: updateWorkRuleAnnualOff,
  });

  return (
    <WorkRuleCardShell
      title="Annual off"
      description="How many off days each worker gets per year."
      scope={scope}
      rules={rules}
    >
      <WorkRuleForm onSubmit={() => void form.handleSubmit()}>
        <form.Field name="annualOffDays">
          {(field) => (
            <WorkRuleNumberField
              id={field.name}
              label="Off days per year"
              suffix="days"
              value={field.state.value}
              errors={field.state.meta.errors}
              disabled={!canEdit || pending}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>
        <form.Subscribe selector={(state) => summaryNumber(state.values.annualOffDays)}>
          {(days) =>
            days !== null && (
              <p className="rounded-lg bg-secondary px-4 py-3 text-sm">
                Each worker gets <span className="font-medium">{days} off days</span> per year.
              </p>
            )
          }
        </form.Subscribe>
        <RuleSourceLine
          ruleKey="annualOffDays"
          scope={rules.scope}
          rules={rules}
          canEdit={canEdit}
          pending={pending}
          onUseInherited={() => inheritWith({ target, annualOffDays: null })}
        />
        <WorkRuleCardFooter
          helper={appliesToText(rules.scope)}
          readOnlyNote={null}
          formError={formError}
          canEdit={canEdit}
          pending={pending}
        />
      </WorkRuleForm>
    </WorkRuleCardShell>
  );
}
