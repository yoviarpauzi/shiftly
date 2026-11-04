"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ACTION_FAILED_MESSAGE } from "@/app/dashboard/requests/request-rules";
import { editRosterCell } from "@/app/dashboard/rosters/actions";
import { warningsAddedMessage } from "@/app/dashboard/rosters/roster-rules";
import type {
  AddWorkerTarget,
  CellChange,
  ReplaceTarget,
  RosterDetailProps,
  SwapCellTarget,
} from "@/types/rosters";
import { AddWorkerDialog } from "@/components/dashboard/rosters/add-worker-dialog";
import { ConfirmRosterDialog } from "@/components/dashboard/rosters/confirm-roster-dialog";
import { ConflictsPanel } from "@/components/dashboard/rosters/conflicts-panel";
import { GenerateAgainDialog } from "@/components/dashboard/rosters/generate-again-dialog";
import { ReplaceWorkerDialog } from "@/components/dashboard/rosters/replace-worker-dialog";
import { RosterGrid } from "@/components/dashboard/rosters/roster-grid";
import { RosterSummary } from "@/components/dashboard/rosters/roster-summary";
import { WarningsPanel } from "@/components/dashboard/rosters/warnings-panel";
import { buttonVariants, Button } from "@/components/ui/button";

export function RosterDetailView({ roster, generateInput }: RosterDetailProps) {
  const [replacing, setReplacing] = useState<ReplaceTarget | null>(null);
  const [adding, setAdding] = useState<AddWorkerTarget | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // A confirmed roster, or one whose request was cancelled, has no menus or buttons.
  const draft = roster.editable;
  const dialogRoster = {
    id: roster.id,
    version: roster.version,
    unfilled: roster.lines.reduce(
      (total, line) => total + line.unfilled.reduce((sum, entry) => sum + entry.shortfall, 0),
      0,
    ),
    edits: roster.counts.edits,
    conflicts: roster.counts.conflicts,
    warnings: roster.counts.warnings,
  };

  // A refused edit shows its reason and leaves the roster as it was.
  async function editCell(change: CellChange) {
    try {
      const result = await editRosterCell({
        rosterId: roster.id,
        version: roster.version,
        lineId: change.lineId,
        workerId: change.workerId,
        date: change.date,
        to:
          change.to.kind === "work"
            ? { kind: "work", shiftId: change.to.shiftId }
            : change.to,
      });

      if (!result.ok) {
        toast.error(result.formError);
        return;
      }

      const warnings = result.warnings?.length ?? 0;

      const message = warningsAddedMessage("Cell updated", warnings);

      if (warnings > 0) {
        toast.warning(message);
      } else {
        toast.success(message);
      }
    } catch {
      toast.error(ACTION_FAILED_MESSAGE);
    }
  }

  function swapCell(target: SwapCellTarget) {
    setReplacing({
      line: { lineId: target.lineId, title: target.lineTitle },
      worker: { workerId: target.workerId, name: target.workerName },
      date: target.date,
      shiftOrder: target.shiftOrder,
    });
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <RosterSummary counts={roster.counts} />
      <RosterGrid
        days={roster.days}
        shifts={roster.shifts}
        lines={roster.lines}
        editable={draft}
        onReplace={setReplacing}
        onEditCell={editCell}
        onSwapCell={swapCell}
        onAddWorker={setAdding}
      />
      <ConflictsPanel conflicts={roster.conflicts} />
      <WarningsPanel warnings={roster.warnings} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/dashboard/rosters" className={buttonVariants({ variant: "outline" })}>
          Back to rosters
        </Link>
        {draft && generateInput && (
          <Button variant="outline" onClick={() => setRegenerating(true)}>
            Generate again
          </Button>
        )}
        {draft && <Button onClick={() => setConfirming(true)}>Confirm roster</Button>}
      </div>
      {draft && (
        <>
          <ReplaceWorkerDialog
            roster={{ id: roster.id, version: roster.version }}
            line={replacing?.line ?? { lineId: "", title: "" }}
            worker={replacing?.worker ?? null}
            date={replacing?.date}
            shiftOrder={replacing?.shiftOrder}
            onOpenChange={(open) => {
              if (!open) setReplacing(null);
            }}
          />
          <AddWorkerDialog
            roster={{
              id: roster.id,
              version: roster.version,
              days: roster.days,
              shifts: roster.shifts,
            }}
            line={adding}
            onOpenChange={(open) => {
              if (!open) setAdding(null);
            }}
          />
          <ConfirmRosterDialog roster={dialogRoster} open={confirming} onOpenChange={setConfirming} />
          {generateInput && (
            <GenerateAgainDialog
              roster={dialogRoster}
              generateInput={generateInput}
              open={regenerating}
              onOpenChange={setRegenerating}
            />
          )}
        </>
      )}
    </div>
  );
}
