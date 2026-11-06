"use client";

import { useEffect, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { ACTION_FAILED_MESSAGE } from "@/app/dashboard/requests/request-rules";
import {
  listCellCandidates,
  listReplacementCandidates,
  replaceRosterWorker,
  swapRosterCellWorker,
} from "@/app/dashboard/rosters/actions";
import {
  filterReplacementCandidates,
  shortDate,
  warningsAddedMessage,
  warningsLabel,
} from "@/app/dashboard/rosters/roster-rules";
import type { ReplaceOption, ReplaceWorkerDialogProps } from "@/types/rosters";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type BodyProps = Omit<ReplaceWorkerDialogProps, "worker"> & {
  worker: NonNullable<ReplaceWorkerDialogProps["worker"]>;
};

// Mounted only while the dialog is open, so every open starts with fresh state and its own load.
function ReplaceWorkerBody({ roster, line, worker, date, shiftOrder, onOpenChange }: BodyProps) {
  const [candidates, setCandidates] = useState<ReplaceOption[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load: Promise<ReplaceOption[]> = date
      ? listCellCandidates({
          rosterId: roster.id,
          lineId: line.lineId,
          date,
          fromWorkerId: worker.workerId,
        }).then((loaded) =>
          loaded.map((candidate) => ({
            ...candidate,
            hard: candidate.hard === null ? [] : [candidate.hard],
          })),
        )
      : listReplacementCandidates({
          rosterId: roster.id,
          lineId: line.lineId,
          fromWorkerId: worker.workerId,
        }).then((loaded) =>
          // The row check lists every reason in one list, so a worker who is impossible for any
          // reason shows them all as not possible.
          loaded.map((candidate) => ({
            workerId: candidate.workerId,
            employeeId: candidate.employeeId,
            name: candidate.name,
            positionNames: candidate.positionNames,
            hard: candidate.hard ? candidate.reasons : [],
            warnings: candidate.hard ? [] : candidate.reasons,
          })),
        );

    load
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
  }, [roster.id, line.lineId, worker.workerId, date]);

  async function handleConfirm() {
    if (!selected) {
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const result = date
        ? await swapRosterCellWorker({
            rosterId: roster.id,
            lineId: line.lineId,
            date,
            fromWorkerId: worker.workerId,
            toWorkerId: selected,
            version: roster.version,
          })
        : await replaceRosterWorker({
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

      toast.success(warningsAddedMessage("Worker replaced", result.warnings?.length ?? 0));
      onOpenChange(false);
    } catch {
      setFormError(ACTION_FAILED_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  }

  // The pick stays even when the search hides it, so the confirm button never changes silently.
  const picked = candidates?.find((candidate) => candidate.workerId === selected) ?? null;
  const shown = candidates ? filterReplacementCandidates(candidates, query) : [];

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {date
            ? `Replace ${worker.name} on ${shortDate(date)} · S${shiftOrder}`
            : `Replace ${worker.name}`}
        </DialogTitle>
        <DialogDescription>
          {date
            ? `The new worker takes this shift on ${shortDate(date)}. ${worker.name} is set to OFF that day.`
            : `Replacing ${worker.name} for the whole roster. The new worker takes the same shifts, OFF days, and BREAK days.`}
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
            <RadioGroup
              value={selected ?? ""}
              onValueChange={(value) => setSelected(value as string)}
              aria-label="Replacement worker"
              className="max-h-72 overflow-y-auto"
            >
              {shown.map((candidate) => {
                const impossible = candidate.hard.length > 0;
                const eligible = !impossible && candidate.warnings.length === 0;

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
                      disabled={impossible}
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
                      {eligible && (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          Eligible: no rule is broken.
                        </span>
                      )}
                      {candidate.hard.map((reason) => (
                        <span key={reason} className="text-destructive">
                          Not possible: {reason}
                        </span>
                      ))}
                      {candidate.warnings.map((reason) => (
                        <span key={reason} className="text-amber-700 dark:text-amber-400">
                          Warning: {reason}
                        </span>
                      ))}
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
          )}
        </>
      )}
      {picked && picked.warnings.length > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Choosing {picked.name} adds {warningsLabel(picked.warnings.length)} to this roster.
        </p>
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
