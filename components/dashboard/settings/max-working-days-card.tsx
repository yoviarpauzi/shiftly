"use client";

import { useForm } from "@tanstack/react-form";
import { updateWorkRuleMaxWorkingDays } from "@/app/dashboard/settings/actions";
import { workRuleTargetFor } from "@/app/dashboard/settings/settings-rules";
import { RuleSourceLine } from "@/components/dashboard/settings/rule-source-line";
import {
  useWorkRuleResult,
  WorkRuleCardFooter,
  WorkRuleCardShell,
  WorkRuleNumberField,
} from "@/components/dashboard/settings/work-rule-card-shell";
import type { WorkRuleCardProps } from "@/types/settings";
import {
  maxWorkingDaysRuleSchema,
  toWholeNumber,
  workRuleFormErrors,
} from "@/validation/settings";

export function MaxWorkingDaysCard({ rules, scope, canEdit }: WorkRuleCardProps) {
  const { formError, setFormError, report, inheriting, inherit } = useWorkRuleResult();
  const target = workRuleTargetFor(rules);
  const toInput = (value: { maxWorkingDaysPerMonth: string }) => ({
    target,
    maxWorkingDaysPerMonth: toWholeNumber(value.maxWorkingDaysPerMonth),
  });

  const form = useForm({
    defaultValues: {
      maxWorkingDaysPerMonth: String(rules.resolved.values.maxWorkingDaysPerMonth),
    },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = maxWorkingDaysRuleSchema.safeParse(toInput(value));

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
      report(await updateWorkRuleMaxWorkingDays(toInput(value)));
    },
  });

  return (
    <WorkRuleCardShell
      title="Max working days per month"
      description="The most working days a worker can be scheduled in one calendar month."
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
              <form.Field name="maxWorkingDaysPerMonth">
                {(field) => (
                  <WorkRuleNumberField
                    id={field.name}
                    label="Max working days"
                    suffix="days per month"
                    value={field.state.value}
                    errors={field.state.meta.errors}
                    disabled={!canEdit || isSubmitting || inheriting}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.Field>
              <form.Subscribe selector={(state) => state.values.maxWorkingDaysPerMonth}>
                {(maxWorkingDays) => (
                  <p className="rounded-lg bg-secondary px-4 py-3 text-sm">
                    Each worker is scheduled for{" "}
                    <span className="font-medium">
                      at most {maxWorkingDays.trim()} working days
                    </span>{" "}
                    in a calendar month.
                  </p>
                )}
              </form.Subscribe>
              <RuleSourceLine
                ruleKey="maxWorkingDaysPerMonth"
                scope={rules.scope}
                rules={rules}
                canEdit={canEdit}
                pending={isSubmitting || inheriting}
                onUseInherited={() =>
                  inherit(() =>
                    updateWorkRuleMaxWorkingDays({ target, maxWorkingDaysPerMonth: null }),
                  )
                }
              />
              <WorkRuleCardFooter
                helper="If the roster cannot stay within this limit, the shift is recorded as a conflict with the reason."
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
