"use client";

import { updateWorkRuleWorkDays } from "@/app/dashboard/settings/actions";
import {
  workDaysDescription,
  workRuleTargetFor,
} from "@/app/dashboard/settings/settings-rules";
import { RuleSourceLine } from "@/components/dashboard/settings/rule-source-line";
import {
  useWorkRuleForm,
  WorkRuleCardFooter,
  WorkRuleCardShell,
  WorkRuleForm,
} from "@/components/dashboard/settings/work-rule-card-shell";
import { Badge } from "@/components/ui/badge";
import { FieldError } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { WorkDays, WorkRuleCardProps } from "@/types/settings";
import { workDaysRuleSchema } from "@/validation/settings";

const OPTIONS: { value: WorkDays; label: string; hint: string; isDefault: boolean }[] = [
  { value: 5, label: "5 days", hint: "Five working days each week.", isDefault: true },
  { value: 7, label: "7 days", hint: "Seven working days each week.", isDefault: false },
];

export function WorkDaysCard({ rules, scope, canEdit, readOnlyNote }: WorkRuleCardProps) {
  const target = workRuleTargetFor(rules);
  const { form, pending, formError, inheritWith } = useWorkRuleForm({
    defaultValues: { workDaysPerWeek: rules.resolved.values.workDaysPerWeek },
    schema: workDaysRuleSchema,
    toInput: (value) => ({ target, ...value }),
    action: updateWorkRuleWorkDays,
  });

  return (
    <WorkRuleCardShell
      title="Working days per week"
      description={workDaysDescription(rules.scope)}
      scope={scope}
      rules={rules}
    >
      <WorkRuleForm onSubmit={() => void form.handleSubmit()}>
        <form.Field name="workDaysPerWeek">
          {(field) => (
            <div className="flex flex-col gap-2">
              <RadioGroup
                aria-label="Working days per week"
                value={field.state.value}
                onValueChange={(value) => field.handleChange(value === 7 ? 7 : 5)}
                disabled={!canEdit || pending}
              >
                {OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border p-4 has-data-checked:border-primary has-data-checked:bg-secondary has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60"
                  >
                    <RadioGroupItem value={option.value} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {option.label}
                        {option.isDefault && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Default
                          </Badge>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
              {field.state.meta.errors.length > 0 && (
                <FieldError errors={field.state.meta.errors} />
              )}
            </div>
          )}
        </form.Field>
        <RuleSourceLine
          ruleKey="workDaysPerWeek"
          scope={rules.scope}
          rules={rules}
          canEdit={canEdit}
          pending={pending}
          onUseInherited={() => inheritWith({ target, workDaysPerWeek: null })}
        />
        <WorkRuleCardFooter
          helper="Applies to workers without their own setting. A worker's own setting is changed in the Worker menu."
          readOnlyNote={readOnlyNote}
          formError={formError}
          canEdit={canEdit}
          pending={pending}
        />
      </WorkRuleForm>
    </WorkRuleCardShell>
  );
}
