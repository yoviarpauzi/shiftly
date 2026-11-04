"use client";

import { updateWorkRuleQualification } from "@/app/dashboard/settings/actions";
import { workRuleTargetFor } from "@/app/dashboard/settings/settings-rules";
import { RuleSourceLine } from "@/components/dashboard/settings/rule-source-line";
import {
  useWorkRuleForm,
  WorkRuleCardFooter,
  WorkRuleCardShell,
  WorkRuleForm,
} from "@/components/dashboard/settings/work-rule-card-shell";
import { FieldError } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type { WorkRuleCardProps } from "@/types/settings";
import { qualificationRuleSchema } from "@/validation/settings";

export function QualificationCard({ rules, scope, canEdit }: WorkRuleCardProps) {
  const target = workRuleTargetFor(rules);
  const { form, pending, formError, inheritWith } = useWorkRuleForm({
    defaultValues: { requirePositionMatch: rules.resolved.values.requirePositionMatch },
    schema: qualificationRuleSchema,
    toInput: (value) => ({ target, ...value }),
    action: updateWorkRuleQualification,
  });

  return (
    <WorkRuleCardShell
      title="Work qualification match"
      description="Whether a worker's positions must match the position on the request line."
      scope={scope}
      rules={rules}
    >
      <WorkRuleForm onSubmit={() => void form.handleSubmit()}>
        <form.Field name="requirePositionMatch">
          {(field) => (
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">Require position match</span>
                  <span className="text-xs text-muted-foreground">
                    Only workers with the request line&apos;s position are assigned.
                  </span>
                </span>
                <Switch
                  checked={field.state.value}
                  onCheckedChange={(checked) => field.handleChange(checked)}
                  disabled={!canEdit || pending}
                />
              </label>
              {field.state.meta.errors.length > 0 && (
                <FieldError errors={field.state.meta.errors} />
              )}
            </div>
          )}
        </form.Field>
        <RuleSourceLine
          ruleKey="requirePositionMatch"
          scope={rules.scope}
          rules={rules}
          canEdit={canEdit}
          pending={pending}
          onUseInherited={() => inheritWith({ target, requirePositionMatch: null })}
        />
        <WorkRuleCardFooter
          helper="When on, a worker is only assigned to a request line whose position is one of their positions. If no worker matches, the shift is recorded as a conflict with the reason."
          readOnlyNote={null}
          formError={formError}
          canEdit={canEdit}
          pending={pending}
        />
      </WorkRuleForm>
    </WorkRuleCardShell>
  );
}
