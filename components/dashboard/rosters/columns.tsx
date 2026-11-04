import {
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
} from "@tanstack/react-table";
import type { RosterRow, RosterSortColumn } from "@/types/rosters";
import type { SortControl } from "@/types/sort";
import { formatRequestDates } from "@/app/dashboard/requests/request-rules";
import { formatRosterTime } from "@/app/dashboard/rosters/roster-rules";
import { SortHeader } from "@/components/dashboard/sort-header";
import { ConflictCount, RosterRowAction } from "@/components/dashboard/rosters/roster-row-parts";
import { RosterStatusBadge } from "@/components/dashboard/rosters/roster-status-badge";

export const features = tableFeatures({
  columnVisibilityFeature,
});

const columnHelper = createColumnHelper<typeof features, RosterRow>();

const TYPE_LABELS = { daily: "Daily", weekly: "Weekly" } as const;

export function createRosterColumns({ sort, onSort }: SortControl<RosterSortColumn>) {
  return columnHelper.columns([
    columnHelper.accessor("poNumber", {
      header: () => <SortHeader label="PO number" column="po" sort={sort} onSort={onSort} />,
      cell: ({ row }) => <span className="font-medium tabular-nums">{row.original.poNumber}</span>,
    }),
    columnHelper.accessor("type", {
      header: () => <SortHeader label="Type" column="type" sort={sort} onSort={onSort} />,
      cell: ({ row }) => TYPE_LABELS[row.original.type],
    }),
    columnHelper.accessor("startDate", {
      header: () => <SortHeader label="Dates" column="date" sort={sort} onSort={onSort} />,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatRequestDates(row.original.type, row.original.startDate)}
        </span>
      ),
    }),
    columnHelper.accessor("locationName", {
      header: () => <SortHeader label="Location" column="location" sort={sort} onSort={onSort} />,
      cell: ({ row }) => row.original.locationName,
    }),
    columnHelper.accessor("status", {
      header: () => <SortHeader label="Roster" column="status" sort={sort} onSort={onSort} />,
      cell: ({ row }) => <RosterStatusBadge status={row.original.status} />,
    }),
    columnHelper.accessor("conflictCount", {
      header: () => <span className="block text-right">Conflicts</span>,
      cell: ({ row }) => (
        <span className="block text-right">
          <ConflictCount count={row.original.conflictCount} />
        </span>
      ),
    }),
    columnHelper.accessor("updatedAt", {
      header: () => <span>Updated</span>,
      cell: ({ row }) =>
        row.original.updatedAt ? (
          <span className="tabular-nums">{formatRosterTime(row.original.updatedAt)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    }),
    columnHelper.display({
      id: "actions",
      header: () => <span className="block text-right">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <RosterRowAction row={row.original} />
        </div>
      ),
      enableHiding: false,
    }),
  ]);
}
