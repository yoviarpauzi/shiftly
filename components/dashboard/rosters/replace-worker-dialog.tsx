"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ACTION_FAILED_MESSAGE } from "@/app/dashboard/requests/request-rules";
import { listReplacementCandidates, replaceRosterWorker } from "@/app/dashboard/rosters/actions";
import type { ReplaceWorkerDialogProps, ReplacementCandidate } from "@/types/rosters";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type BodyProps = Omit<ReplaceWorkerDialogProps, "worker"> & {
  worker: NonNullable<ReplaceWorkerDialogProps["worker"]>;
};

// Mounted only while the dialog is open, so every open starts with fresh state and its own load.
function ReplaceWorkerBody({ roster, line, worker, onOpenChange }: BodyProps) {
  const [candidates, setCandidates] = useState<ReplacementCandidate[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    listReplacementCandidates({
      rosterId: roster.id,
      lineId: line.lineId,
      fromWorkerId: worker.workerId,
    })
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
  }, [roster.id, line.lineId, worker.workerId]);

  async function handleConfirm() {
    if (!selected) {
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const result = await replaceRosterWorker({
        rosterId: roster.id,
        lineId: line.lineId,
        fromWorkerId: worker.workerId,
        toWorkerId: selected,
        version: roster.version,
      });

      if (!result.ok) {
        setFormError(result.formError);
        return;
      }

      toast.success("Worker replaced");
      onOpenChange(false);
    } catch {
      setFormError(ACTION_FAILED_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Replace {worker.name}</DialogTitle>
        <DialogDescription>
          Replacing {worker.name} for the whole roster. The new worker takes the same shifts, OFF
          days, and BREAK days.
        </DialogDescription>
      </DialogHeader>
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
        <RadioGroup
          value={selected ?? ""}
          onValueChange={(value) => setSelected(value as string)}
          aria-label="Replacement worker"
          className="max-h-72 overflow-y-auto"
        >
          {candidates.map((candidate) => {
            const eligible = candidate.reasons.length === 0;

            return (
              <label
                key={candidate.workerId}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-sm",
                  eligible ? "cursor-pointer" : "cursor-not-allowed opacity-80",
                )}
              >
                <RadioGroupItem
                  value={candidate.workerId}
                  disabled={!eligible}
                  className="mt-0.5"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">
                    {candidate.name}{" "}
                    <span className="font-normal text-muted-foreground">{candidate.employeeId}</span>
                  </span>
                  {candidate.positionNames.length > 0 && (
                    <span className="text-muted-foreground">{candidate.positionNames.join(", ")}</span>
                  )}
                  {eligible ? (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      Eligible: no rule is broken.
                    </span>
                  ) : (
                    candidate.reasons.map((reason) => (
                      <span key={reason} className="text-destructive">
                        {reason}
                      </span>
                    ))
                  )}
                </span>
              </label>
            );
          })}
        </RadioGroup>
      )}
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button disabled={isSubmitting || !selected} onClick={handleConfirm}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          Replace worker
        </Button>
      </DialogFooter>
    </>
  );
}

export function ReplaceWorkerDialog({ worker, ...props }: ReplaceWorkerDialogProps) {
  return (
    <Dialog open={worker !== null} onOpenChange={props.onOpenChange}>
      <DialogContent>{worker && <ReplaceWorkerBody worker={worker} {...props} />}</DialogContent>
    </Dialog>
  );
}
