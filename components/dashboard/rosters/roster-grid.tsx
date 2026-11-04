"use client";

import { EllipsisIcon, PlusIcon, UserRoundPenIcon } from "lucide-react";
import { useState } from "react";
import { dayLabel, shortDate } from "@/app/dashboard/rosters/roster-rules";
import type { CellChange, RosterCell, RosterGridProps } from "@/types/rosters";
import { CellMenu } from "@/components/dashboard/rosters/cell-menu";
import { ShiftChip } from "@/components/dashboard/shift-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const chip = "inline-flex h-6 min-w-10 items-center justify-center rounded-md px-2 text-xs font-medium";

function CellValue({ cell }: { cell: RosterCell }) {
  if (cell === null) {
    return <span className="text-muted-foreground">·</span>;
  }

  if (cell.kind === "work") {
    return <ShiftChip order={cell.shiftOrder} />;
  }

  if (cell.kind === "off") {
    return <span className="text-xs font-medium text-muted-foreground">OFF</span>;
  }

  return <span className={cn(chip, "border text-muted-foreground")}>BREAK</span>;
}

// A cell with its marks: a primary ring when it was edited by hand, an amber dot when it breaks a
// rule. The marks have text for a screen reader, and the legend names them for everyone else.
function CellView({ cell }: { cell: RosterCell }) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-md",
        cell?.edited && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <CellValue cell={cell} />
      {cell?.warning && (
        <span
          aria-hidden
          className="absolute -top-1.5 -right-1.5 size-2 rounded-full bg-amber-500 ring-2 ring-background"
        />
      )}
      {(cell?.edited || cell?.warning) && (
        <span className="sr-only">
          {[cell.edited ? "edited" : null, cell.warning ? "has a warning" : null]
            .filter(Boolean)
            .join(", ")}
        </span>
      )}
    </span>
  );
}

// "Edit Budi Santoso, Tue 10 Nov", plus the cell's marks, which the button's name would hide.
function cellLabel(name: string, date: string, cell: RosterCell): string {
  const marks = [cell?.edited ? "edited" : null, cell?.warning ? "has a warning" : null].filter(Boolean);

  return [`Edit ${name}, ${shortDate(date)}`, ...marks].join(", ");
}

function Legend({ editable }: { editable: boolean }) {
  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      {editable && (
        <p>
          Select a cell to change its shift, make it a day off or a break, clear it, or replace the
          worker.
        </p>
      )}
      <ul className="flex flex-wrap items-center gap-4">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-4 rounded-sm ring-2 ring-primary ring-offset-2 ring-offset-background" />
          Edited by hand
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-2 rounded-full bg-amber-500" />
          Breaks a rule
        </li>
      </ul>
    </div>
  );
}

// One group per line: a row per worker, then the shifts nobody could fill. It scrolls sideways
// inside its card, so a week does not widen the page. In a draft every cell is a button and each
// group ends with Add worker. One edit saves at a time: every cell is disabled until it is done.
export function RosterGrid({
  days,
  shifts,
  lines,
  editable,
  onReplace,
  onEditCell,
  onSwapCell,
  onAddWorker,
}: RosterGridProps) {
  const [saving, setSaving] = useState(false);
  const columns = days.length + (editable ? 2 : 1);

  async function handleEdit(change: CellChange) {
    setSaving(true);

    try {
      await onEditCell(change);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Legend editable={editable} />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Worker
              </th>
              {days.map((date) => (
                <th key={date} scope="col" className="px-2 py-2 text-center font-medium tabular-nums">
                  {dayLabel(date)}
                </th>
              ))}
              {editable && (
                <th scope="col" className="px-2 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          {lines.map((line) => (
            <tbody key={line.lineId} className="border-t">
              <tr className="bg-muted/50">
                <th scope="colgroup" colSpan={columns} className="px-3 py-2 text-left font-medium">
                  {line.title} · {line.shiftLabel}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {[...new Set(line.perDay)].length === 1
                      ? `${line.perDay[0]} per day`
                      : `${line.perDay.join(" / ")} per day`}
                  </span>
                </th>
              </tr>
              {line.workers.map((worker) => (
                <tr key={worker.workerId} className="border-t">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{worker.name}</span>
                      <span className="text-xs text-muted-foreground">{worker.employeeId}</span>
                      {worker.replaced && <Badge variant="secondary">Replaced</Badge>}
                    </span>
                  </th>
                  {worker.cells.map((cell, index) => {
                    const date = days[index];

                    return (
                      <td key={date} className="px-2 py-1.5 text-center">
                        {editable ? (
                          <CellMenu
                            label={cellLabel(worker.name, date, cell)}
                            cell={cell}
                            shifts={shifts}
                            disabled={saving}
                            onChoose={(to) =>
                              void handleEdit({
                                lineId: line.lineId,
                                workerId: worker.workerId,
                                date,
                                to,
                              })
                            }
                            onReplace={() => {
                              if (cell?.kind === "work") {
                                onSwapCell({
                                  lineId: line.lineId,
                                  lineTitle: line.title,
                                  workerId: worker.workerId,
                                  workerName: worker.name,
                                  date,
                                  shiftOrder: cell.shiftOrder,
                                });
                              }
                            }}
                          >
                            <CellView cell={cell} />
                          </CellMenu>
                        ) : (
                          <CellView cell={cell} />
                        )}
                      </td>
                    );
                  })}
                  {editable && (
                    <td className="px-2 py-1 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={saving}
                              aria-label={`Actions for ${worker.name}`}
                            />
                          }
                        >
                          <EllipsisIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-auto min-w-48">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onClick={() =>
                                onReplace({
                                  line: { lineId: line.lineId, title: line.title },
                                  worker: { workerId: worker.workerId, name: worker.name },
                                })
                              }
                            >
                              <UserRoundPenIcon />
                              Replace worker
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              ))}
              {line.unfilled.length > 0 && (
                <tr className="border-t bg-destructive/5">
                  <th scope="row" className="px-3 py-2 text-left font-medium text-destructive">
                    Unfilled
                  </th>
                  {days.map((date) => (
                    <td key={date} className="px-2 py-2 text-center">
                      <span className="flex flex-col items-center gap-1">
                        {line.unfilled
                          .filter((entry) => entry.date === date)
                          .map((entry) => (
                            <span
                              key={entry.shiftOrder}
                              className={cn(chip, "bg-destructive/10 text-destructive")}
                            >
                              S{entry.shiftOrder} −{entry.shortfall}
                            </span>
                          ))}
                      </span>
                    </td>
                  ))}
                  {editable && <td />}
                </tr>
              )}
              {editable && (
                <tr className="border-t">
                  <td colSpan={columns} className="px-2 py-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      aria-label={`Add worker to ${line.title}`}
                      onClick={() => onAddWorker({ lineId: line.lineId, lineTitle: line.title })}
                    >
                      <PlusIcon data-icon="inline-start" />
                      Add worker
                    </Button>
                  </td>
                </tr>
              )}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
