"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import {
  listSubstituteCandidates,
  setSubstitute,
} from "@/app/dashboard/attendance/actions";
import { substituteLabel } from "@/app/dashboard/attendance/attendance-rules";
import { ACTION_FAILED_MESSAGE } from "@/app/dashboard/requests/request-rules";
import {
  filterReplacementCandidates,
  warningsAddedMessage,
} from "@/app/dashboard/rosters/roster-rules";
import type { SubstituteActionResult, SubstituteDialogProps } from "@/types/attendance";
import type { ReplaceOption } from "@/types/rosters";
import { setSubstituteSchema } from "@/validation/attendance";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type BodyProps = Pick<SubstituteDialogProps, "onOpenChange"> & {
  row: NonNullable<SubstituteDialogProps["row"]>;
};

// Mounted only while the dialog is open, so every open starts with fresh state and its own load.
function SubstituteBody({ row, onOpenChange }: BodyProps) {
  const router = useRouter();
  const current = row.substitute;
  const [candidates, setCandidates] = useState<ReplaceOption[] | null>(null);
  const [query, setQuery] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    listSubstituteCandidates({ assignmentId: row.assignmentId })
      .then((loaded) => {
        if (!cancelled) setCandidates(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setCandidates([]);
          setFormError(ACTION_FAILED_MESSAGE);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [row.assignmentId]);

  // Both buttons end the same way: a message, the dialog closed, and the page read again.
  function finish(result: SubstituteActionResult, removed: boolean) {
    if (!result.ok) {
      setFormError(result.formError);
      return;
    }

    if (removed) {
      toast.success("Replacement removed");
    } else if (result.warnings.length > 0) {
      toast.warning(warningsAddedMessage("Replacement saved", result.warnings.length));
    } else {
      toast.success("Replacement saved");
    }

    onOpenChange(false);
    router.refresh();
  }

  const form = useForm({
    // The current replacement starts chosen, so the admin sees who covers now.
    defaultValues: { substituteWorkerId: current?.workerId ?? "" },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = setSubstituteSchema.safeParse({
          assignmentId: row.assignmentId,
          substituteWorkerId: value.substituteWorkerId,
        });

        return parsed.success
          ? undefined
          : { fields: { substituteWorkerId: { message: parsed.error.issues[0].message } } };
      },
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      try {
        finish(
          await setSubstitute({
            assignmentId: row.assignmentId,
            substituteWorkerId: value.substituteWorkerId,
          }),
          false,
        );
      } catch {
        setFormError(ACTION_FAILED_MESSAGE);
      }
    },
  });

  async function handleRemove() {
    setFormError(null);
    setIsRemoving(true);

    try {
      finish(await setSubstitute({ assignmentId: row.assignmentId, substituteWorkerId: null }), true);
    } catch {
      setFormError(ACTION_FAILED_MESSAGE);
    } finally {
      setIsRemoving(false);
    }
  }

  const shown = candidates ? filterReplacementCandidates(candidates, query) : [];

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{current ? "Change replacement" : `Replace ${row.workerName}`}</DialogTitle>
        <DialogDescription>
          {current
            ? `${row.workerName} is absent. ${substituteLabel(current)}.`
            : `${row.workerName} is absent. The worker you choose covers this shift and counts as present. ${row.workerName} stays Absent.`}
        </DialogDescription>
      </DialogHeader>
      <form.Subscribe
        selector={(state) => ({
          saving: state.isSubmitting,
          picked: state.values.substituteWorkerId,
        })}
      >
        {({ saving, picked }) => {
          const busy = saving || isRemoving;

          return (
            <>
              {candidates === null ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Spinner />
                  Checking the rules for each worker
                </div>
              ) : candidates.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No other worker at this location can be considered.
                </p>
              ) : (
                <>
                  <div className="relative">
                    <SearchIcon
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        // Escape clears the search first. The dialog closes on the next press.
                        if (event.key === "Escape" && query !== "") {
                          event.preventDefault();
                          event.stopPropagation();
                          setQuery("");
                        }
                      }}
                      placeholder="Search name, ID or position"
                      aria-label="Search replacement workers"
                      className="pr-10 pl-8 [&::-webkit-search-cancel-button]:appearance-none"
                    />
                    {query !== "" && (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                        className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        <XIcon className="size-4" />
                      </button>
                    )}
                  </div>
                  {shown.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">
                      No worker matches &ldquo;{query.trim()}&rdquo;.
                    </p>
                  ) : (
                    <form.Field name="substituteWorkerId">
                      {(field) => (
                        <>
                          <RadioGroup
                            value={field.state.value}
                            onValueChange={(value) => field.handleChange(value as string)}
                            aria-label="Replacement worker"
                            className="max-h-72 overflow-y-auto"
                          >
                            {shown.map((candidate) => {
                              const impossible = candidate.hard.length > 0;

                              return (
                                <label
                                  key={candidate.workerId}
                                  className={cn(
                                    "flex items-start gap-3 rounded-lg border p-3 text-sm",
                                    impossible ? "cursor-not-allowed opacity-80" : "cursor-pointer",
                                  )}
                                >
                                  <RadioGroupItem
                                    value={candidate.workerId}
                                    disabled={impossible || busy}
                                    className="mt-0.5"
                                  />
                                  <span className="flex min-w-0 flex-col gap-0.5">
                                    <span className="font-medium">
                                      {candidate.name}{" "}
                                      <span className="font-normal text-muted-foreground">
                                        {candidate.employeeId}
                                      </span>
                                    </span>
                                    {candidate.positionNames.length > 0 && (
                                      <span className="text-muted-foreground">
                                        {candidate.positionNames.join(", ")}
                                      </span>
                                    )}
                                    {candidate.hard.map((reason) => (
                                      <span key={reason} className="text-destructive">
                                        Not possible: {reason}
                                      </span>
                                    ))}
                                    {!impossible &&
                                      candidate.warnings.map((reason) => (
                                        <span key={reason} className="text-muted-foreground">
                                          {reason}
                                        </span>
                                      ))}
                                  </span>
                                </label>
                              );
                            })}
                          </RadioGroup>
                          {field.state.meta.errors.length > 0 && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </>
                      )}
                    </form.Field>
                  )}
                </>
              )}
              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}
              <DialogFooter>
                {current && (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive sm:mr-auto"
                    disabled={busy}
                    onClick={handleRemove}
                  >
                    {isRemoving && <Spinner data-icon="inline-start" />}
                    Remove replacement
                  </Button>
                )}
                <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || picked === "" || picked === current?.workerId}>
                  {saving && <Spinner data-icon="inline-start" />}
                  {current ? "Change replacement" : "Save replacement"}
                </Button>
              </DialogFooter>
            </>
          );
        }}
      </form.Subscribe>
    </form>
  );
}

export function SubstituteDialog({ open, onOpenChange, row }: SubstituteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && row && <SubstituteBody key={row.assignmentId} row={row} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}
