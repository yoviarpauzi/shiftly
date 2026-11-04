import { EllipsisIcon, UserRoundPenIcon } from "lucide-react";
import { dayLabel } from "@/app/dashboard/rosters/roster-rules";
import type { RosterCell, RosterGridProps } from "@/types/rosters";
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

function Cell({ cell }: { cell: RosterCell }) {
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

// One group per line: a row per worker, then the shifts nobody could fill. It scrolls sideways
// inside its card, so a week does not widen the page.
export function RosterGrid({ days, lines, editable, onReplace }: RosterGridProps) {
  const columns = days.length + (editable ? 2 : 1);

  return (
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
                {line.title}
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
                {worker.cells.map((cell, index) => (
                  <td key={days[index]} className="px-2 py-2 text-center">
                    <Cell cell={cell} />
                  </td>
                ))}
                {editable && (
                  <td className="px-2 py-1 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
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
          </tbody>
        ))}
      </table>
    </div>
  );
}
