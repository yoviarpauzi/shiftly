import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { formatShiftRange } from "@/app/dashboard/shifts/shift-rules";
import type { HistoryCellProps } from "@/types/worker-history";
import { ShiftChip } from "@/components/dashboard/shift-chip";

// Cells the table and the mobile cards share, so a day reads the same on both.

// The shift and its hours. Only work days are listed, and every work day has a shift.
export function HistoryShiftCell({ row }: HistoryCellProps) {
  if (!row.shift) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="flex items-center gap-2">
      <ShiftChip order={row.shift.order} />
      <span className="text-muted-foreground tabular-nums">
        {formatShiftRange(row.shift.startTime, row.shift.endTime)}
      </span>
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
