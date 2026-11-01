import Link from "next/link";
import {
  columnVisibilityFeature,
  createColumnHelper,
  rowSelectionFeature,
  tableFeatures,
} from "@tanstack/react-table";
import { BanIcon, CircleCheckIcon } from "lucide-react";
import type { DepartmentRow, DepartmentSortColumn } from "@/types/departments";
import type { SortControl } from "@/types/sort";
import { SortHeader } from "@/components/dashboard/sort-header";
import { Badge } from "@/components/ui/badge";

export const features = tableFeatures({
  columnVisibilityFeature,
  rowSelectionFeature,
});

const columnHelper = createColumnHelper<typeof features, DepartmentRow>();

export function createDepartmentColumns({
  sort,
  onSort,
}: SortControl<DepartmentSortColumn>) {
  return columnHelper.columns([
    columnHelper.accessor("name", {
      header: () => (
        <SortHeader label="Name" column="name" sort={sort} onSort={onSort} />
      ),
      cell: ({ row }) => (
        <Link
          href={`/dashboard/departments/${row.original.id}`}
          className="font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {row.original.name}
        </Link>
      ),
    }),
    columnHelper.accessor("locationName", {
      header: () => (
        <SortHeader label="Location" column="location" sort={sort} onSort={onSort} />
      ),
      cell: ({ row }) => row.original.locationName,
    }),
    columnHelper.accessor("subDepartmentCount", {
      header: "Sub-departments",
      cell: ({ row }) => row.original.subDepartmentCount,
    }),
    columnHelper.accessor("deletedAt", {
      header: () => (
        <div className="pl-8">
          <SortHeader label="Status" column="status" sort={sort} onSort={onSort} />
        </div>
      ),
      cell: ({ row }) => (
        <div className="pl-8">
          <Badge variant="outline" className="px-1.5 text-muted-foreground">
            {row.original.deletedAt ? (
              <BanIcon />
            ) : (
              <CircleCheckIcon className="fill-green-500 dark:fill-green-400" />
            )}
            {row.original.deletedAt ? "Deleted" : "Active"}
          </Badge>
        </div>
      ),
    }),
  ]);
}
