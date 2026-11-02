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
  WorkerActions,
  WorkerPositionTag,
  WorkerRow,
  WorkerSortColumn,
} from "@/types/workers";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const features = tableFeatures({
  columnVisibilityFeature,
  rowSelectionFeature,
});

// One position shows as is. Several show the first one and "+N", and hovering shows them all.
function PositionTags({ positions }: { positions: WorkerPositionTag[] }) {
  if (positions.length === 0) {
    return <span className="text-muted-foreground">None</span>;
  }

  const [first, ...rest] = positions;

  if (rest.length === 0) {
    return <Badge variant="secondary">{first.name}</Badge>;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<button type="button" className="flex items-center gap-1 rounded-md" />}
      >
        <Badge variant="secondary">{first.name}</Badge>
        <Badge variant="secondary">+{rest.length}</Badge>
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start">
        {positions.map((position) => (
          <span key={position.id}>{position.name}</span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

const columnHelper = createColumnHelper<typeof features, WorkerRow>();

export function createWorkerColumns(
  { onEdit, onDelete, onRestore }: WorkerActions,
  { sort, onSort }: SortControl<WorkerSortColumn>,
) {
  return columnHelper.columns([
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all workers on this page"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={
            table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
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
    columnHelper.accessor("employeeId", {
      header: () => (
        <SortHeader label="Employee ID" column="employeeId" sort={sort} onSort={onSort} />
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.employeeId}</span>,
    }),
    columnHelper.accessor("name", {
      header: () => <SortHeader label="Name" column="name" sort={sort} onSort={onSort} />,
      cell: ({ row }) => row.original.name,
    }),
    columnHelper.accessor("siteName", {
      header: () => <SortHeader label="Site" column="site" sort={sort} onSort={onSort} />,
      cell: ({ row }) => row.original.siteName,
    }),
    columnHelper.accessor("locationName", {
      header: () => (
        <SortHeader label="Location" column="location" sort={sort} onSort={onSort} />
      ),
      cell: ({ row }) => row.original.locationName,
    }),
    columnHelper.display({
      id: "positions",
      header: () => <span>Positions</span>,
      cell: ({ row }) => <PositionTags positions={row.original.positions} />,
    }),
    columnHelper.accessor("endContract", {
      header: () => <span>Contract end</span>,
      cell: ({ row }) => row.original.endContract,
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
