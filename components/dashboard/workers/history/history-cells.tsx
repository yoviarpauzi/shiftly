import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { formatShiftRange } from "@/app/dashboard/shifts/shift-rules";
import type { HistoryCellProps } from "@/types/worker-history";
import { ShiftChip } from "@/components/dashboard/shift-chip";
import { Badge } from "@/components/ui/badge";

// Cells the table and the mobile cards share, so a day reads the same on both.

// A work day shows its shift and hours. An off or break day has no shift, so it shows what it is.
export function HistoryShiftCell({ row }: HistoryCellProps) {
  if (!row.shift) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {row.kind === "break" ? "Break" : "Off"}
      </Badge>
    );
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

// The PO opens the roster the day came from. Off and break days only show it.
export function HistoryPoCell({ row }: HistoryCellProps) {
  if (row.kind !== "work") {
    return <span className="tabular-nums">{row.poNumber}</span>;
  }

  return (
    <Link
      href={`/dashboard/rosters/${row.rosterId}`}
      className="text-primary tabular-nums underline-offset-4 hover:underline"
    >
      {row.poNumber}
    </Link>
  );
}
