"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTable } from "@tanstack/react-table"
import { PlusIcon } from "lucide-react"
import { TablePagination } from "@/components/dashboard/pagination"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  LocationOption,
  ManagedUser,
  UserAccess,
  UserChoices,
  UserPage,
  UserRoleFilter,
  UserStatusFilter,
} from "@/types/users"
import { createUserColumns, features } from "./columns"
import { DeactivateUserDialog } from "./deactivate-user-dialog"
import { UserFormDialog } from "./user-form-dialog"
import { UsersSearch } from "./users-search"
import { type UserFilterOption, UsersSelectFilter } from "./users-select-filter"

const STATUS_OPTIONS: (UserFilterOption & { value: UserStatusFilter })[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "banned", label: "Banned" },
]

const ROLE_OPTIONS: (UserFilterOption & { value: UserRoleFilter })[] = [
  { value: "all", label: "All roles" },
  { value: "superadmin", label: "Superadmin" },
  { value: "ho", label: "HO" },
  { value: "admin_site", label: "Admin site" },
]

export function UsersDataTable({
  data,
  access,
  choices,
  status,
  role,
  siteId,
  locations,
  locationId,
}: {
  data: UserPage
  access: UserAccess
  choices: UserChoices
  status: UserStatusFilter
  role: UserRoleFilter
  siteId: string | null
  locations: LocationOption[]
  locationId: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [formOpen, setFormOpen] = React.useState(false)
  const [formKey, setFormKey] = React.useState(0)
  const [editingUser, setEditingUser] = React.useState<ManagedUser | null>(null)
  const [statusKey, setStatusKey] = React.useState(0)
  const [statusUser, setStatusUser] = React.useState<ManagedUser | null>(null)

  // A new key remounts the dialog, so each open starts from the right defaults. The dialog gets a copy of
  // the row, so a refresh of the page data cannot change it while it is open or closing.
  const openForm = React.useCallback((user: ManagedUser | null) => {
    setEditingUser(user ? { ...user } : null)
    setFormKey((key) => key + 1)
    setFormOpen(true)
  }, [])

  const openStatusDialog = React.useCallback((user: ManagedUser) => {
    setStatusUser({ ...user })
    setStatusKey((key) => key + 1)
  }, [])

  const columns = React.useMemo(
    () => createUserColumns(access, { onEdit: openForm, onChangeStatus: openStatusDialog }),
    [access, openForm, openStatusDialog],
  )

  const pagination = {
    pageIndex: data.page - 1,
    pageSize: data.pageSize,
  }

  function goToPage(page: number, pageSize: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", `${page}`)
    params.set("pageSize", `${pageSize}`)
    router.push(`${pathname}?${params.toString()}`)
  }

  const table = useTable({
    features,
    data: data.rows,
    columns,
    getRowId: (row) => row.id,
    manualPagination: true,
    rowCount: data.total,
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater(pagination) : updater
      goToPage(next.pageIndex + 1, next.pageSize)
    },
    state: {
      pagination,
    },
  })

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <UsersSearch total={data.total} />
          <UsersSelectFilter
            param="status"
            value={status}
            options={STATUS_OPTIONS}
            ariaLabel="Filter users by status"
            className="h-9 w-36"
          />
          <UsersSelectFilter
            param="role"
            value={role}
            options={ROLE_OPTIONS}
            ariaLabel="Filter users by role"
            className="h-9 w-36"
          />
          {access.siteId === null && (
            <UsersSelectFilter
              param="site"
              value={siteId ?? "all"}
              options={[
                { value: "all", label: "All sites" },
                ...choices.sites.map((site) => ({ value: site.id, label: site.name })),
              ]}
              ariaLabel="Filter users by site"
              className="h-9 w-48"
              resets={["location"]}
            />
          )}
          {(access.siteId !== null || siteId !== null) && (
            <UsersSelectFilter
              param="location"
              value={locationId ?? "all"}
              options={[
                { value: "all", label: "All locations" },
                ...locations.map((location) => ({
                  value: location.id,
                  label: location.name,
                })),
              ]}
              ariaLabel="Filter users by location"
              className="h-9 w-48"
            />
          )}
        </div>
        <Button onClick={() => openForm(null)}>
          <PlusIcon data-icon="inline-start" />
          Add user
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {data.total} {data.total === 1 ? "user" : "users"}
        </div>
        <TablePagination
          page={data.page}
          pageCount={table.getPageCount()}
          pageSize={data.pageSize}
          onPageChange={(page) => goToPage(page, data.pageSize)}
          onPageSizeChange={(pageSize) => goToPage(1, pageSize)}
        />
      </div>
      <UserFormDialog
        key={`form-${formKey}`}
        user={editingUser}
        access={access}
        choices={choices}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
      <DeactivateUserDialog
        key={`status-${statusKey}`}
        user={statusUser}
        onOpenChange={(open) => {
          if (!open) {
            setStatusUser(null)
          }
        }}
      />
    </div>
  )
}
