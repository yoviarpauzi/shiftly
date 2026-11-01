import {
  columnVisibilityFeature,
  createColumnHelper,
  rowSelectionFeature,
  tableFeatures,
} from "@tanstack/react-table";
import { EllipsisIcon, PencilIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import type { LocationActions, LocationRow } from "@/types/locations";
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

const columnHelper = createColumnHelper<typeof features, LocationRow>();

export function createLocationColumns({ onEdit, onDelete, onRestore }: LocationActions) {
  return columnHelper.columns([
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all locations on this page"
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
      header: "Name",
      cell: ({ row }) => row.original.name,
    }),
    columnHelper.accessor("siteName", {
      header: "Site",
      cell: ({ row }) => row.original.siteName,
    }),
    columnHelper.accessor("deletedAt", {
      header: () => <span className="block pl-8">Status</span>,
      cell: ({ row }) => (
        <div className="pl-8">
          <Badge variant="outline">
            <span
              aria-hidden
              className={`size-2 rounded-full ${row.original.deletedAt ? "bg-destructive" : "bg-accent-text"}`}
            />
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
