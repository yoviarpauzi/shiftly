import { cn } from "@/lib/utils";
import { shortDate } from "@/app/dashboard/rosters/roster-rules";
import type { HistoryCardsProps } from "@/types/worker-history";
import { HistoryAttendanceBadge } from "./history-attendance-badge";
import { HistoryDepartmentCell, HistoryPoCell, HistoryShiftCell } from "./history-cells";

// The same days as the table, one card each, for a phone. A work day shows its attendance at the
// top right; an off or break day shows what it is there and has no shift line.
export function HistoryCards({ rows }: HistoryCardsProps) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const work = row.kind === "work";

        return (
          <li
            key={row.assignmentId}
            className={cn("flex flex-col gap-2.5 rounded-xl border p-4", !work && "text-muted-foreground")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {shortDate(row.date)}
              </span>
              {work ? (
                <HistoryAttendanceBadge attendance={row.attendance} />
              ) : (
                <HistoryShiftCell row={row} />
              )}
            </div>
            {work ? <HistoryShiftCell row={row} /> : null}
            <div className="text-sm">
              <HistoryDepartmentCell row={row} />
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              <span>{row.positionName}</span>
              <span aria-hidden>·</span>
              <HistoryPoCell row={row} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
