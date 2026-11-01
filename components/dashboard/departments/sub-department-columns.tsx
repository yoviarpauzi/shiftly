import { createColumnHelper, tableFeatures } from "@tanstack/react-table";
import {
  BanIcon,
  CircleCheckIcon,
  EllipsisIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import type { SubDepartmentActions, SubDepartmentRow } from "@/types/departments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// The table has no search, sort, selection, or pagination, so it needs no optional feature.
export const subDepartmentFeatures = tableFeatures({});

const columnHelper = createColumnHelper<typeof subDepartmentFeatures, SubDepartmentRow>();

export function createSubDepartmentColumns({
  onEdit,
  onDelete,
  onRestore,
}: SubDepartmentActions) {
  return columnHelper.columns([
    columnHelper.accessor("name", {
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    }),
    columnHelper.accessor("deletedAt", {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className="px-1.5 text-muted-foreground">
          {row.original.deletedAt ? (
            <BanIcon />
          ) : (
            <CircleCheckIcon className="fill-green-500 dark:fill-green-400" />
          )}
          {row.original.deletedAt ? "Deleted" : "Active"}
        </Badge>
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
    }),
  ]);
}
