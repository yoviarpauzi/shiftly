"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ACTION_FAILED_MESSAGE } from "@/app/dashboard/requests/request-rules";
import { editRosterCell } from "@/app/dashboard/rosters/actions";
import {
  filterLines,
  GRID_PAGE_SIZE,
  lineFilterOptions,
  lineSummary,
  pageLines,
  warningsAddedMessage,
} from "@/app/dashboard/rosters/roster-rules";
import type {
  AddWorkerTarget,
  CellChange,
  ReplaceTarget,
  RosterDetailProps,
  RosterLineFilters,
  SwapCellTarget,
} from "@/types/rosters";
import { AddWorkerDialog } from "@/components/dashboard/rosters/add-worker-dialog";
import { ConfirmRosterDialog } from "@/components/dashboard/rosters/confirm-roster-dialog";
import { ConflictsPanel } from "@/components/dashboard/rosters/conflicts-panel";
import { GenerateAgainDialog } from "@/components/dashboard/rosters/generate-again-dialog";
import { ReplaceWorkerDialog } from "@/components/dashboard/rosters/replace-worker-dialog";
import { RosterGrid } from "@/components/dashboard/rosters/roster-grid";
import { RosterGridFilters } from "@/components/dashboard/rosters/roster-grid-filters";
import { RosterSummary } from "@/components/dashboard/rosters/roster-summary";
import { WarningsPanel } from "@/components/dashboard/rosters/warnings-panel";
import { TablePagination } from "@/components/dashboard/pagination";
import { buttonVariants, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NO_FILTERS: RosterLineFilters = {
  departmentId: null,
  subDepartmentId: null,
  positionId: null,
  shiftOrder: null,
  attention: false,
  search: "",
};

export function RosterDetailView({ roster, generateInput }: RosterDetailProps) {
  const [replacing, setReplacing] = useState<ReplaceTarget | null>(null);
  const [adding, setAdding] = useState<AddWorkerTarget | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  // The grid's filters, search, and page live here, not in the URL: a change should not load the
  // roster and work its warnings out again.
  const [filters, setFilters] = useState(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(GRID_PAGE_SIZE);

  const shown = filterLines(roster.lines, filters);
  const paged = pageLines(shown, page, pageSize);
  // A worker can be added to any line the filters leave. Search only narrows workers, so it does
  // not take a line out of this list.
  const addTargets = filterLines(roster.lines, { ...filters, search: "" }).map((line) => ({
    lineId: line.lineId,
    lineTitle: line.title,
  }));
  // The conflicts and warnings sit in a column beside the grid on a wide screen, and under it on a
  // narrow one. With neither, the grid has the whole width.
  const hasPanels = roster.conflicts.length > 0 || roster.warnings.length > 0;

  function changeFilters(patch: Partial<RosterLineFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(NO_FILTERS);
    setPage(1);
  }

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="lg:flex-1">
          <RosterSummary counts={roster.counts} />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row lg:shrink-0">
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
      </div>
      <div
        className={cn(
          "grid gap-4 md:gap-6",
          hasPanels && "xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start",
        )}
      >
        <div className="flex min-w-0 flex-col gap-3">
          <RosterGridFilters
          filters={filters}
          options={lineFilterOptions(roster.lines, filters.departmentId)}
          shifts={roster.shifts}
          summary={lineSummary(shown, roster.lines.length)}
          attentionCount={roster.counts.conflicts + roster.counts.warnings}
          addTargets={draft ? addTargets : null}
          onAddWorker={setAdding}
          onChange={changeFilters}
          onClear={clearFilters}
        />
        <RosterGrid
          days={roster.days}
          shifts={roster.shifts}
          lines={paged.slices}
          focusShift={filters.shiftOrder}
          editable={draft}
          onReplace={setReplacing}
          onEditCell={editCell}
          onSwapCell={swapCell}
        />
        {(paged.pageCount > 1 || pageSize !== GRID_PAGE_SIZE) && (
          <div className="flex justify-end">
            <TablePagination
              page={paged.page}
              pageCount={paged.pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        )}
        </div>
        {hasPanels && (
          <div className="flex flex-col gap-4">
            <ConflictsPanel conflicts={roster.conflicts} />
            <WarningsPanel warnings={roster.warnings} />
          </div>
        )}
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
