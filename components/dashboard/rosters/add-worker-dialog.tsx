"use client";

import { useForm } from "@tanstack/react-form";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ACTION_FAILED_MESSAGE } from "@/app/dashboard/requests/request-rules";
import {
  editRosterCell,
  listAddableWorkers,
  previewCellChange,
} from "@/app/dashboard/rosters/actions";
import { shortDate, warningsAddedMessage } from "@/app/dashboard/rosters/roster-rules";
import type {
  AddableWorker,
  AddWorkerDialogProps,
  AddWorkerValues,
  CellTarget,
  PreviewAnswer,
} from "@/types/rosters";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

type BodyProps = Omit<AddWorkerDialogProps, "line"> & {
  line: NonNullable<AddWorkerDialogProps["line"]>;
};

// The choice field holds a shift's id, or "off" or "break".
function toTarget(choice: string, shifts: AddWorkerDialogProps["roster"]["shifts"]): CellTarget | null {
  if (choice === "off" || choice === "break") {
    return { kind: choice };
  }

  const picked = shifts.find((entry) => entry.id === choice);

  return picked ? { kind: "work", shiftId: picked.id, shiftOrder: picked.order } : null;
}

// "" until a worker is chosen: there is nothing to ask before that.
function previewKey(values: AddWorkerValues): string {
  return values.workerId ? `${values.workerId}|${values.date}|${values.choice}` : "";
}

function toInput(to: CellTarget) {
  return to.kind === "work" ? ({ kind: "work", shiftId: to.shiftId } as const) : to;
}

// What the edit would do, asked again whenever the worker, the day, or the shift changes. A
// slower answer for a choice that was changed since is dropped.
function PreviewLine({
  rosterId,
  lineId,
  shifts,
  values,
  answer,
  onAnswer,
}: {
  rosterId: string;
  lineId: string;
  shifts: AddWorkerDialogProps["roster"]["shifts"];
  values: AddWorkerValues;
  answer: PreviewAnswer | null;
  onAnswer: (answer: PreviewAnswer) => void;
}) {
  const { workerId, date, choice } = values;
  const key = previewKey(values);

  useEffect(() => {
    const to = toTarget(choice, shifts);

    if (!key || !to) {
      return;
    }

    let cancelled = false;

    previewCellChange({ rosterId, lineId, workerId, date, to: toInput(to) })
      .then((preview) => {
        if (!cancelled) onAnswer({ key, preview });
      })
      .catch(() => {
        if (!cancelled) onAnswer({ key, preview: null });
      });

    return () => {
      cancelled = true;
    };
  }, [key, rosterId, lineId, workerId, date, choice, shifts, onAnswer]);

  const preview = answer?.key === key ? answer.preview : null;
  const loading = key !== "" && answer?.key !== key;

  return (
    <div aria-live="polite" className="flex min-h-10 flex-col gap-0.5 text-sm">
      {loading && (
        <span className="flex items-center gap-2 text-muted-foreground">
          <Spinner />
          Checking the rules
        </span>
      )}
      {preview?.hard && <span className="text-destructive">Not possible: {preview.hard}</span>}
      {preview && preview.hard === null && preview.warnings.length === 0 && (
        <span className="text-emerald-700 dark:text-emerald-400">No rule is broken.</span>
      )}
      {preview?.hard === null &&
        preview.warnings.map((warning) => (
          <span key={warning} className="text-amber-700 dark:text-amber-400">
            Warning: {warning}
          </span>
        ))}
    </div>
  );
}

// Mounted only while the dialog is open, so every open starts with fresh state and its own load.
function AddWorkerBody({ roster, line, onOpenChange }: BodyProps) {
  const [workers, setWorkers] = useState<AddableWorker[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<PreviewAnswer | null>(null);

  useEffect(() => {
    let cancelled = false;

    listAddableWorkers({ rosterId: roster.id, lineId: line.lineId })
      .then((loaded) => {
        if (!cancelled) setWorkers(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkers([]);
          setFormError(ACTION_FAILED_MESSAGE);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [roster.id, line.lineId]);

  const choices = [
    ...roster.shifts.map((entry) => ({
      value: entry.id,
      label: `Shift ${entry.order} · ${entry.startTime} - ${entry.endTime}`,
    })),
    { value: "off", label: "Day off" },
    { value: "break", label: "Break" },
  ];
  const days = roster.days.map((date) => ({ value: date, label: shortDate(date) }));

  const form = useForm({
    defaultValues: {
      workerId: "",
      date: roster.days[0] ?? "",
      choice: roster.shifts[0]?.id ?? "off",
    },
    validators: {
      onSubmit: ({ value }) =>
        value.workerId ? undefined : { fields: { workerId: { message: "Choose a worker" } } },
    },
    onSubmit: async ({ value }) => {
      const to = toTarget(value.choice, roster.shifts);

      if (!to) {
        setFormError("Choose a shift");
        return;
      }

      setFormError(null);

      try {
        const result = await editRosterCell({
          rosterId: roster.id,
          version: roster.version,
          lineId: line.lineId,
          workerId: value.workerId,
          date: value.date,
          to: toInput(to),
        });

        if (!result.ok) {
          setFormError(result.formError);
          return;
        }

        toast.success(warningsAddedMessage("Worker added", result.warnings?.length ?? 0));
        onOpenChange(false);
      } catch {
        setFormError(ACTION_FAILED_MESSAGE);
      }
    },
  });

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <DialogHeader>
        <DialogTitle>Add worker</DialogTitle>
        <DialogDescription>
          Add a worker to {line.lineTitle} for one day. Their other days stay empty.
        </DialogDescription>
      </DialogHeader>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <>
            <FieldGroup>
              <form.Field name="workerId">
                {(field) => {
                  const isInvalid = field.state.meta.errors.length > 0;

                  return (
                    <Field data-invalid={isInvalid || undefined}>
                      <FieldLabel htmlFor={field.name}>Worker</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(value) => {
                          if (value) {
                            field.handleChange(value);
                          }
                        }}
                        items={(workers ?? []).map((entry) => ({
                          value: entry.workerId,
                          label: `${entry.name} · ${entry.employeeId}`,
                        }))}
                        disabled={isSubmitting || workers === null}
                      >
                        <SelectTrigger
                          id={field.name}
                          aria-invalid={isInvalid || undefined}
                          className="w-full"
                        >
                          <SelectValue
                            placeholder={
                              workers === null
                                ? "Loading workers"
                                : workers.length === 0
                                  ? "Every worker is already in this roster"
                                  : "Choose a worker"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {(workers ?? []).map((entry) => (
                              <SelectItem key={entry.workerId} value={entry.workerId}>
                                {entry.name} · {entry.employeeId}
                                {entry.positionNames.length > 0 &&
                                  ` · ${entry.positionNames.join(", ")}`}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                  );
                }}
              </form.Field>
              <form.Field name="date">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Day</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => {
                        if (value) {
                          field.handleChange(value);
                        }
                      }}
                      items={days}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id={field.name} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {days.map((day) => (
                            <SelectItem key={day.value} value={day.value}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>
              <form.Field name="choice">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Shift</FieldLabel>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => {
                        if (value) {
                          field.handleChange(value);
                        }
                      }}
                      items={choices}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id={field.name} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {choices.map((choice) => (
                            <SelectItem key={choice.value} value={choice.value}>
                              {choice.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </form.Field>
            </FieldGroup>
            <form.Subscribe selector={(state) => state.values}>
              {(values) => (
                <PreviewLine
                  rosterId={roster.id}
                  lineId={line.lineId}
                  shifts={roster.shifts}
                  values={values}
                  answer={answer}
                  onAnswer={setAnswer}
                />
              )}
            </form.Subscribe>
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <form.Subscribe selector={(state) => state.values}>
                {(values) => (
                  <Button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      (answer?.key === previewKey(values) && answer.preview?.hard != null)
                    }
                  >
                    {isSubmitting && <Spinner data-icon="inline-start" />}
                    Add worker
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}

export function AddWorkerDialog({ line, ...props }: AddWorkerDialogProps) {
  return (
    <Dialog open={line !== null} onOpenChange={props.onOpenChange}>
      <DialogContent>{line && <AddWorkerBody line={line} {...props} />}</DialogContent>
    </Dialog>
  );
}
