import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { formatShiftRange } from "@/app/dashboard/shifts/shift-rules";
import { coveredForText } from "@/app/dashboard/workers/worker-history-rules";
import type { HistoryCellProps } from "@/types/worker-history";
import { ShiftChip } from "@/components/dashboard/shift-chip";

// Cells the table and the mobile cards share, so a day reads the same on both.

// The shift and its hours, with "Covered for <name>" under them on a day worked as a replacement.
// Only work days are listed, and every work day has a shift.
export function HistoryShiftCell({ row }: HistoryCellProps) {
  if (!row.shift) {
    return <span className="text-muted-foreground">—</span>;
  }

  const covered = coveredForText(row);

  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex items-center gap-2">
        <ShiftChip order={row.shift.order} />
        <span className="text-muted-foreground tabular-nums">
          {formatShiftRange(row.shift.startTime, row.shift.endTime)}
        </span>
      </span>
      {covered ? <span className="text-xs text-muted-foreground">{covered}</span> : null}
    </span>
  );
}

export function HistoryDepartmentCell({ row }: HistoryCellProps) {
  return (
    <span className="flex flex-wrap items-center gap-x-1">
      {row.departmentName}
      {row.subDepartmentName ? (
        <>
          <ChevronRightIcon className="size-3.5 text-muted-foreground" aria-hidden />
          {row.subDepartmentName}
        </>
      ) : null}
    </span>
  );
}

// The PO opens the roster the day came from.
export function HistoryPoCell({ row }: HistoryCellProps) {
  return (
    <Link
      href={`/dashboard/rosters/${row.rosterId}`}
      className="text-primary tabular-nums underline-offset-4 hover:underline"
    >
      {row.poNumber}
    </Link>
  );
}
