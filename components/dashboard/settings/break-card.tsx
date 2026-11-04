"use client";

import { updateWorkRuleBreak } from "@/app/dashboard/settings/actions";
import {
  appliesToText,
  countText,
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
import { breakRuleSchema, toWholeNumber } from "@/validation/settings";

// Only the working-days card shows the read-only note, so the level explains itself once.
export function BreakCard({ rules, scope, canEdit }: WorkRuleCardProps) {
  const target = workRuleTargetFor(rules);
  const { form, pending, formError, inheritWith } = useWorkRuleForm({
    defaultValues: {
      breakDays: String(rules.resolved.values.breakDays),
      breakCycleMonths: String(rules.resolved.values.breakCycleMonths),
    },
    schema: breakRuleSchema,
    toInput: (value) => ({
      target,
      breakDays: toWholeNumber(value.breakDays),
      breakCycleMonths: toWholeNumber(value.breakCycleMonths),
    }),
    action: updateWorkRuleBreak,
  });

  return (
    <WorkRuleCardShell
      title="Break"
      description="How many break days each worker gets, and how often."
      scope={scope}
      rules={rules}
    >
      <WorkRuleForm onSubmit={() => void form.handleSubmit()}>
        <div className="flex gap-3">
          <form.Field name="breakDays">
            {(field) => (
              <WorkRuleNumberField
                id={field.name}
                label="Break days"
                suffix="days"
                value={field.state.value}
                errors={field.state.meta.errors}
                disabled={!canEdit || pending}
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
                disabled={!canEdit || pending}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              />
            )}
          </form.Field>
        </div>
        <form.Subscribe selector={(state) => state.values}>
          {(values) => {
            const days = summaryNumber(values.breakDays);
            const months = summaryNumber(values.breakCycleMonths);

            return (
              days !== null &&
              months !== null && (
                <p className="rounded-lg bg-secondary px-4 py-3 text-sm">
                  Each worker gets{" "}
                  <span className="font-medium">{countText(days, "break day")}</span> every{" "}
                  {countText(months, "month")}.
                </p>
              )
            );
          }}
        </form.Subscribe>
        <RuleSourceLine
          ruleKey="breakDays"
          scope={rules.scope}
          rules={rules}
          canEdit={canEdit}
          pending={pending}
          onUseInherited={() => inheritWith({ target, breakDays: null, breakCycleMonths: null })}
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
