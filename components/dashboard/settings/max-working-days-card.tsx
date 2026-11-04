"use client";

import { updateWorkRuleMaxWorkingDays } from "@/app/dashboard/settings/actions";
import { summaryNumber, workRuleTargetFor } from "@/app/dashboard/settings/settings-rules";
import { RuleSourceLine } from "@/components/dashboard/settings/rule-source-line";
import {
  useWorkRuleForm,
  WorkRuleCardFooter,
  WorkRuleCardShell,
  WorkRuleForm,
  WorkRuleNumberField,
} from "@/components/dashboard/settings/work-rule-card-shell";
import type { WorkRuleCardProps } from "@/types/settings";
import { maxWorkingDaysRuleSchema, toWholeNumber } from "@/validation/settings";

export function MaxWorkingDaysCard({ rules, scope, canEdit }: WorkRuleCardProps) {
  const target = workRuleTargetFor(rules);
  const { form, pending, formError, inheritWith } = useWorkRuleForm({
    defaultValues: {
      maxWorkingDaysPerMonth: String(rules.resolved.values.maxWorkingDaysPerMonth),
    },
    schema: maxWorkingDaysRuleSchema,
    toInput: (value) => ({
      target,
      maxWorkingDaysPerMonth: toWholeNumber(value.maxWorkingDaysPerMonth),
    }),
    action: updateWorkRuleMaxWorkingDays,
  });

  return (
    <WorkRuleCardShell
      title="Max working days per month"
      description="The most working days a worker can be scheduled in one calendar month."
      scope={scope}
      rules={rules}
    >
      <WorkRuleForm onSubmit={() => void form.handleSubmit()}>
        <form.Field name="maxWorkingDaysPerMonth">
          {(field) => (
            <WorkRuleNumberField
              id={field.name}
              label="Max working days"
              suffix="days per month"
              value={field.state.value}
              errors={field.state.meta.errors}
              disabled={!canEdit || pending}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>
        <form.Subscribe selector={(state) => summaryNumber(state.values.maxWorkingDaysPerMonth)}>
          {(days) =>
            days !== null && (
              <p className="rounded-lg bg-secondary px-4 py-3 text-sm">
                Each worker is scheduled for{" "}
                <span className="font-medium">at most {days} working days</span> in a calendar
                month.
              </p>
            )
          }
        </form.Subscribe>
        <RuleSourceLine
          ruleKey="maxWorkingDaysPerMonth"
          scope={rules.scope}
          rules={rules}
          canEdit={canEdit}
          pending={pending}
          onUseInherited={() => inheritWith({ target, maxWorkingDaysPerMonth: null })}
        />
        <WorkRuleCardFooter
          helper="If the roster cannot stay within this limit, the shift is recorded as a conflict with the reason."
          readOnlyNote={null}
          formError={formError}
          canEdit={canEdit}
          pending={pending}
        />
      </WorkRuleForm>
    </WorkRuleCardShell>
  );
}
