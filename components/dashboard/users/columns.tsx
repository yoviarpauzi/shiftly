import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table"
import {
  BanIcon,
  CircleCheckIcon,
  EllipsisVerticalIcon,
  PencilIcon,
  RotateCcwIcon,
  UserXIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { canManageUser } from "@/app/dashboard/users/user-access"
import type { ManagedUser, UserAccess, UserActions } from "@/types/users"

export const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
})

const columnHelper = createColumnHelper<typeof features, ManagedUser>()

export function createUserColumns(
  access: UserAccess,
  { onEdit, onChangeStatus }: UserActions,
) {
  return columnHelper.columns([
    columnHelper.accessor("name", {
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    }),
    columnHelper.accessor("email", {
      header: "Email",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.email}</span>
      ),
    }),
    columnHelper.accessor("role", {
      header: "Role",
      cell: ({ row }) => (
        <Badge variant="outline" className="px-1.5 text-muted-foreground capitalize">
          {row.original.role ?? "No role"}
        </Badge>
      ),
    }),
    columnHelper.accessor("siteName", {
      header: "Site",
      cell: ({ row }) => row.original.siteName ?? "—",
    }),
    columnHelper.accessor("locationName", {
      header: "Location",
      cell: ({ row }) => row.original.locationName ?? "—",
    }),
    columnHelper.accessor("banned", {
      header: "Status",
      cell: ({ row }) =>
        row.original.banned ? (
          <Badge variant="outline" className="px-1.5 text-muted-foreground">
            <BanIcon />
            Banned
          </Badge>
        ) : (
          <Badge variant="outline" className="px-1.5 text-muted-foreground">
            <CircleCheckIcon className="fill-green-500 dark:fill-green-400" />
            Active
          </Badge>
        ),
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) =>
        // An empty cell keeps the column width, so rows the actor cannot manage show no actions.
        !canManageUser(access, {
          id: row.original.id,
          role: row.original.role,
          siteId: null,
          locationSiteId: row.original.siteId,
          banned: row.original.banned ?? false,
        }) ? (
          <div className="size-8" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="flex size-8 text-muted-foreground data-open:bg-muted"
                  size="icon"
                />
              }
            >
              <EllipsisVerticalIcon />
              <span className="sr-only">Actions for {row.original.name}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <PencilIcon />
                Edit
              </DropdownMenuItem>
              {row.original.banned ? (
                <DropdownMenuItem onClick={() => onChangeStatus(row.original)}>
                  <RotateCcwIcon />
                  Reactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onChangeStatus(row.original)}
                >
                  <UserXIcon />
                  Deactivate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
    }),
  ])
}
