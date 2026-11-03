"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReplaceTarget, RosterDetailProps } from "@/types/rosters";
import { ConfirmRosterDialog } from "@/components/dashboard/rosters/confirm-roster-dialog";
import { ConflictsPanel } from "@/components/dashboard/rosters/conflicts-panel";
import { GenerateAgainDialog } from "@/components/dashboard/rosters/generate-again-dialog";
import { ReplaceWorkerDialog } from "@/components/dashboard/rosters/replace-worker-dialog";
import { RosterGrid } from "@/components/dashboard/rosters/roster-grid";
import { RosterSummary } from "@/components/dashboard/rosters/roster-summary";
import { buttonVariants, Button } from "@/components/ui/button";

export function RosterDetailView({ roster, generateInput }: RosterDetailProps) {
  const [replacing, setReplacing] = useState<ReplaceTarget | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const draft = roster.status === "draft";
  const dialogRoster = {
    id: roster.id,
    version: roster.version,
    unfilled: roster.lines.reduce(
      (total, line) => total + line.unfilled.reduce((sum, entry) => sum + entry.shortfall, 0),
      0,
    ),
    edits: roster.counts.edits,
    conflicts: roster.counts.conflicts,
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <RosterSummary counts={roster.counts} />
      <RosterGrid
        days={roster.days}
        lines={roster.lines}
        editable={draft}
        onReplace={setReplacing}
      />
      <ConflictsPanel conflicts={roster.conflicts} />
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
            onOpenChange={(open) => {
              if (!open) setReplacing(null);
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
