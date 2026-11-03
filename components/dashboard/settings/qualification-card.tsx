"use client";

import { useForm } from "@tanstack/react-form";
import { updateWorkRuleQualification } from "@/app/dashboard/settings/actions";
import { workRuleTargetFor } from "@/app/dashboard/settings/settings-rules";
import { RuleSourceLine } from "@/components/dashboard/settings/rule-source-line";
import {
  useWorkRuleResult,
  WorkRuleCardFooter,
  WorkRuleCardShell,
} from "@/components/dashboard/settings/work-rule-card-shell";
import { FieldError } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type { WorkRuleCardProps } from "@/types/settings";
import { qualificationRuleSchema, workRuleFormErrors } from "@/validation/settings";

export function QualificationCard({ rules, scope, canEdit }: WorkRuleCardProps) {
  const { formError, setFormError, report, inheriting, inherit } = useWorkRuleResult();
  const target = workRuleTargetFor(rules);

  const form = useForm({
    defaultValues: { requirePositionMatch: rules.resolved.values.requirePositionMatch },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = qualificationRuleSchema.safeParse({ target, ...value });

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
      report(await updateWorkRuleQualification({ target, ...value }));
    },
  });

  return (
    <WorkRuleCardShell
      title="Work qualification match"
      description="Whether a worker's positions must match the position on the request line."
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
                        disabled={!canEdit || isSubmitting || inheriting}
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
                pending={isSubmitting || inheriting}
                onUseInherited={() =>
                  inherit(() => updateWorkRuleQualification({ target, requirePositionMatch: null }))
                }
              />
              <WorkRuleCardFooter
                helper="When on, a worker is only assigned to a request line whose position is one of their positions. If no worker matches, the shift is recorded as a conflict with the reason."
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
