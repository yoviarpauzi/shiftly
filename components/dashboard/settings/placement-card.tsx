"use client";

import { updateWorkRulePlacement } from "@/app/dashboard/settings/actions";
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
import { placementRuleSchema } from "@/validation/settings";

export function PlacementCard({ rules, scope, canEdit }: WorkRuleCardProps) {
  const target = workRuleTargetFor(rules);
  const { form, pending, formError, inheritWith } = useWorkRuleForm({
    defaultValues: { keepPreviousPlacement: rules.resolved.values.keepPreviousPlacement },
    schema: placementRuleSchema,
    toInput: (value) => ({ target, ...value }),
    action: updateWorkRulePlacement,
  });

  return (
    <WorkRuleCardShell
      title="Keep previous placement"
      description="Whether an automatic roster puts a worker back in the department they worked in last time."
      scope={scope}
      rules={rules}
    >
      <WorkRuleForm onSubmit={() => void form.handleSubmit()}>
        <form.Field name="keepPreviousPlacement">
          {(field) => (
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium">Prefer previous department</span>
                  <span className="text-xs text-muted-foreground">
                    Workers who worked in the line&apos;s department in their last confirmed roster
                    are assigned first.
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
          ruleKey="keepPreviousPlacement"
          scope={rules.scope}
          rules={rules}
          canEdit={canEdit}
          pending={pending}
          onUseInherited={() => inheritWith({ target, keepPreviousPlacement: null })}
        />
        <WorkRuleCardFooter
          helper="When on, the roster still fills every shift. A worker from another department is used when too few workers match, and all other rules still apply."
          readOnlyNote={null}
          formError={formError}
          canEdit={canEdit}
          pending={pending}
        />
      </WorkRuleForm>
    </WorkRuleCardShell>
  );
}
