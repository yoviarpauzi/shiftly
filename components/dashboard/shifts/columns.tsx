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
  ShiftActions,
  ShiftRow,
  ShiftSortColumn,
} from "@/types/shifts";
import type { SortControl } from "@/types/sort";
import { formatShiftRange } from "@/app/dashboard/shifts/shift-rules";
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

const columnHelper = createColumnHelper<typeof features, ShiftRow>();

export function createShiftColumns(
  { onEdit, onDelete, onRestore }: ShiftActions,
  { sort, onSort }: SortControl<ShiftSortColumn>,
) {
  return columnHelper.columns([
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all shifts on this page"
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
    columnHelper.accessor("order", {
      header: () => (
        <SortHeader label="Order" column="order" sort={sort} onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.order}</span>
      ),
    }),
    columnHelper.accessor("name", {
      header: () => (
        <SortHeader label="Name" column="name" sort={sort} onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    }),
    columnHelper.display({
      id: "time",
      header: () => <span>Time</span>,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatShiftRange(row.original.startTime, row.original.endTime)}
        </span>
      ),
    }),
    columnHelper.accessor("siteName", {
      header: () => (
        <SortHeader label="Site" column="site" sort={sort} onSort={onSort} />
      ),
      cell: ({ row }) => row.original.siteName,
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
            <DropdownMenuContent align="end" className="w-auto min-w-48">
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
