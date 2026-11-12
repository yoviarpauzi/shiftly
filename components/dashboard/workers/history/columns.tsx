import { columnVisibilityFeature, createColumnHelper, tableFeatures } from "@tanstack/react-table";
import { weekdayName } from "@/app/dashboard/workers/worker-history-rules";
import type { SortControl } from "@/types/sort";
import type { HistorySortColumn, WorkerHistoryRow } from "@/types/worker-history";
import { SortHeader } from "@/components/dashboard/sort-header";
import { HistoryAttendanceBadge } from "./history-attendance-badge";
import { HistoryDepartmentCell, HistoryPoCell, HistoryShiftCell } from "./history-cells";

// Row cells come from the column visibility feature in TanStack Table v9, so it is needed even
// though the columns never hide.
export const features = tableFeatures({ columnVisibilityFeature });

const columnHelper = createColumnHelper<typeof features, WorkerHistoryRow>();

export function createHistoryColumns({ sort, onSort }: SortControl<HistorySortColumn>) {
  return columnHelper.columns([
    columnHelper.accessor("date", {
      header: () => <SortHeader label="Date" column="date" sort={sort} onSort={onSort} />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.date}</span>,
    }),
    columnHelper.display({
      id: "day",
      header: () => <span>Day</span>,
      cell: ({ row }) => weekdayName(row.original.date),
    }),
    columnHelper.display({
      id: "shift",
      header: () => <span>Shift</span>,
      cell: ({ row }) => <HistoryShiftCell row={row.original} />,
    }),
    columnHelper.display({
      id: "department",
      header: () => <span>Department</span>,
      cell: ({ row }) => <HistoryDepartmentCell row={row.original} />,
    }),
    columnHelper.accessor("positionName", {
      header: () => <span>Position</span>,
      cell: ({ row }) => row.original.positionName,
    }),
    columnHelper.display({
      id: "po",
      header: () => <span>PO</span>,
      cell: ({ row }) => <HistoryPoCell row={row.original} />,
    }),
    columnHelper.display({
      id: "attendance",
      header: () => <span>Attendance</span>,
      cell: ({ row }) => <HistoryAttendanceBadge attendance={row.original.attendance} />,
    }),
  ]);
}
