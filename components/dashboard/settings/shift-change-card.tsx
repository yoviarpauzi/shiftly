"use client";

import { useForm } from "@tanstack/react-form";
import { CheckIcon, XIcon } from "lucide-react";
import { updateWorkRuleShiftChange } from "@/app/dashboard/settings/actions";
import { workRuleTargetFor } from "@/app/dashboard/settings/settings-rules";
import { RuleSourceLine } from "@/components/dashboard/settings/rule-source-line";
import {
  useWorkRuleResult,
  WorkRuleCardFooter,
  WorkRuleCardShell,
  WorkRuleNumberField,
} from "@/components/dashboard/settings/work-rule-card-shell";
import type { WorkRuleCardProps } from "@/types/settings";
import { shiftChangeRuleSchema, toWholeNumber, workRuleFormErrors } from "@/validation/settings";

// Display only: the order of shifts is fixed by the rule, so these moves are not stored.
const ALLOWED_MOVES = ["1 → 2", "2 → 3", "1 → 3"];
const BLOCKED_MOVES = ["2 → 1", "3 → 1", "3 → 2"];

export function ShiftChangeCard({ rules, scope, canEdit }: WorkRuleCardProps) {
  const { formError, setFormError, report, inheriting, inherit } = useWorkRuleResult();
  const target = workRuleTargetFor(rules);
  const toInput = (value: { shiftExceptionDays: string }) => ({
    target,
    shiftExceptionDays: toWholeNumber(value.shiftExceptionDays),
  });

  const form = useForm({
    defaultValues: { shiftExceptionDays: String(rules.resolved.values.shiftExceptionDays) },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = shiftChangeRuleSchema.safeParse(toInput(value));

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
      report(await updateWorkRuleShiftChange(toInput(value)));
    },
  });

  return (
    <WorkRuleCardShell
      title="Shift change"
      description="Shift numbers follow the order set in the Shift menu. A worker can move to a higher number, but not back to a lower one."
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
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Allowed</p>
            <ul className="flex flex-wrap gap-2">
              {ALLOWED_MOVES.map((move) => (
                <li
                  key={move}
                  className="flex items-center gap-1.5 rounded-md bg-accent-tint py-1 pr-3 pl-2.5 text-sm font-medium"
                >
                  <CheckIcon aria-hidden className="size-3.5 text-accent-text" />
                  {move}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Not allowed</p>
            <ul className="flex flex-wrap gap-2">
              {BLOCKED_MOVES.map((move) => (
                <li
                  key={move}
                  className="flex items-center gap-1.5 rounded-md bg-destructive/10 py-1 pr-3 pl-2.5 text-sm font-medium"
                >
                  <XIcon aria-hidden className="size-3.5 text-destructive" />
                  {move}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <>
              <form.Field name="shiftExceptionDays">
                {(field) => (
                  <WorkRuleNumberField
                    id={field.name}
                    label="Exception after"
                    suffix="working days"
                    value={field.state.value}
                    errors={field.state.meta.errors}
                    disabled={!canEdit || isSubmitting || inheriting}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                  />
                )}
              </form.Field>
              <RuleSourceLine
                ruleKey="shiftExceptionDays"
                scope={rules.scope}
                rules={rules}
                canEdit={canEdit}
                pending={isSubmitting || inheriting}
                onUseInherited={() =>
                  inherit(() => updateWorkRuleShiftChange({ target, shiftExceptionDays: null }))
                }
              />
              <WorkRuleCardFooter
                helper="A worker who has worked this many working days may move to a lower shift number."
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
