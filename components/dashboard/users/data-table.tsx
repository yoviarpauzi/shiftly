"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTable, type RowSelectionState } from "@tanstack/react-table"
import { TablePagination } from "@/components/dashboard/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { UserPage } from "@/types/users"
import { columns, features } from "./columns"
import { UsersSearch } from "./users-search"

export function UsersDataTable({ data }: { data: UserPage }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

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
    enableRowSelection: true,
    manualPagination: true,
    rowCount: data.total,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater(pagination) : updater
      goToPage(next.pageIndex + 1, next.pageSize)
    },
    state: {
      rowSelection,
      pagination,
    },
  })

  return (
    <div className="flex w-full flex-col gap-4">
      <UsersSearch total={data.total} />
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
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
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
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <TablePagination
          page={data.page}
          pageCount={table.getPageCount()}
          pageSize={data.pageSize}
          onPageChange={(page) => goToPage(page, data.pageSize)}
          onPageSizeChange={(pageSize) => goToPage(1, pageSize)}
        />
      </div>
    </div>
  )
}
