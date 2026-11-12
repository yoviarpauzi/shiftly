import { shortDate } from "@/app/dashboard/rosters/roster-rules";
import type { HistoryCardsProps } from "@/types/worker-history";
import { HistoryAttendanceBadge } from "./history-attendance-badge";
import { HistoryDepartmentCell, HistoryPoCell, HistoryShiftCell } from "./history-cells";

// The same days as the table, one card each, for a phone: the date and attendance on top, then the
// shift, the department, and the position with the PO.
export function HistoryCards({ rows }: HistoryCardsProps) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.assignmentId} className="flex flex-col gap-2.5 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{shortDate(row.date)}</span>
            <HistoryAttendanceBadge attendance={row.attendance} />
          </div>
          <HistoryShiftCell row={row} />
          <div className="text-sm">
            <HistoryDepartmentCell row={row} />
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span>{row.positionName}</span>
            <span aria-hidden>·</span>
            <HistoryPoCell row={row} />
          </div>
        </li>
      ))}
    </ul>
  );
}
