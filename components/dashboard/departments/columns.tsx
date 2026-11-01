import Link from "next/link";
import {
  columnVisibilityFeature,
  createColumnHelper,
  rowSelectionFeature,
  tableFeatures,
} from "@tanstack/react-table";
import {
  BanIcon,
  CircleCheckIcon,
  EllipsisIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import type {
  DepartmentActions,
  DepartmentRow,
  DepartmentSortColumn,
} from "@/types/departments";
import type { SortControl } from "@/types/sort";
import { SortHeader } from "@/components/dashboard/sort-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const features = tableFeatures({
  columnVisibilityFeature,
  rowSelectionFeature,
});

const columnHelper = createColumnHelper<typeof features, DepartmentRow>();

export function createDepartmentColumns(
  { onEdit, onDelete, onRestore }: DepartmentActions,
  { sort, onSort }: SortControl<DepartmentSortColumn>,
) {
  return columnHelper.columns([
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all departments on this page"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Select ${row.original.name}`}
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
        />
      ),
      enableHiding: false,
    }),
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
    columnHelper.display({
      id: "actions",
      header: () => <span className="block text-right">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${row.original.name}`}
                />
              }
            >
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                {row.original.deletedAt === null ? (
                  <>
                    <DropdownMenuItem onClick={() => onEdit(row.original)}>
                      <PencilIcon />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDelete(row.original)}
                    >
                      <Trash2Icon />
                      Delete
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={() => onRestore(row.original)}>
                    <RotateCcwIcon />
                    Restore
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      enableHiding: false,
    }),
  ]);
}
