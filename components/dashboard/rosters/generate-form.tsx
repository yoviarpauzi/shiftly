"use client";

import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { generateRoster } from "@/app/dashboard/rosters/actions";
import { splitsToTargets, targetsTotalError } from "@/app/dashboard/rosters/roster-rules";
import type { GenerateFormProps } from "@/types/rosters";
import { ShiftGrid } from "@/components/dashboard/rosters/shift-grid";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const ROSTERS_PATH = "/dashboard/rosters";

export function GenerateForm({ view }: GenerateFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  // splits[line][day][shiftIndex]
  const form = useForm({
    defaultValues: { splits: view.lines.map((line) => line.split) },
    onSubmit: async ({ value }) => {
      setFormError(null);

      const result = await generateRoster({
        requestId: view.requestId,
        targets: splitsToTargets(
          view.lines.map((line) => line.lineId),
          view.days,
          view.shifts.map((shift) => shift.id),
          value.splits,
        ),
        version: view.version,
      });

      if (!result.ok) {
        setFormError(result.formError);
        return;
      }

      setCreated(true);
      toast.success("Roster generated");
      router.push(result.rosterId ? `${ROSTERS_PATH}/${result.rosterId}` : ROSTERS_PATH);
    },
  });

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        // Enter in a field submits too, so the guard is here as well as on the button.
        if (created) return;
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(state) => ({ splits: state.values.splits, busy: state.isSubmitting })}>
        {({ splits, busy }) => {
          const invalidDays = view.lines.map((line, lineIndex) => {
            const error = targetsTotalError(line.required, splits[lineIndex]);

            return error ? error.dayIndex : null;
          });
          const blocked = invalidDays.some((day) => day !== null) || view.shifts.length === 0;

          return (
            <>
              {view.shifts.length === 0 ? (
                <p role="alert" className="text-sm text-destructive">
                  This site has no shifts yet. Add shifts before you generate a roster.
                </p>
              ) : (
                view.lines.map((line, lineIndex) => (
                  <ShiftGrid
                    key={line.lineId}
                    line={{ ...line, split: splits[lineIndex] }}
                    days={view.days}
                    shifts={view.shifts}
                    invalidDay={invalidDays[lineIndex]}
                    disabled={busy || created}
                    onChange={(day, shiftIndex, value) => {
                      const next = splits.map((lineSplit) => lineSplit.map((daySplit) => [...daySplit]));

                      next[lineIndex][day][shiftIndex] = value;
                      form.setFieldValue("splits", next);
                    }}
                  />
                ))
              )}
              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Link href={ROSTERS_PATH} className={buttonVariants({ variant: "outline" })}>
                  Back to rosters
                </Link>
                <Button type="submit" disabled={busy || created || blocked}>
                  {busy && <Spinner data-icon="inline-start" />}
                  Generate roster
                </Button>
              </div>
            </>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
