"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTable } from "@tanstack/react-table";
import { nextSort } from "@/lib/sort";
import { parseSortParam, serializeSort } from "@/validation/sort";
import type { RosterDataTableProps, RosterSortColumn } from "@/types/rosters";
import { TablePagination } from "@/components/dashboard/pagination";
import { createRosterColumns, features } from "@/components/dashboard/rosters/columns";
import { RosterCards } from "@/components/dashboard/rosters/roster-cards";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SORT_COLUMNS = [
  "po",
  "type",
  "date",
  "location",
  "status",
] as const satisfies readonly RosterSortColumn[];

export function RostersDataTable({ page: data }: RosterDataTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const sort = React.useMemo(
    () => parseSortParam(searchParams.get("sort") ?? undefined, SORT_COLUMNS),
    [searchParams],
  );

  // A header click changes the URL, so the server sorts the page. The page goes back to 1.
  const sortBy = React.useCallback(
    (column: RosterSortColumn, shift: boolean) => {
      const next = nextSort(sort, column, shift);
      const params = new URLSearchParams(searchParams.toString());

      if (next.length > 0) {
        params.set("sort", serializeSort(next));
      } else {
        params.delete("sort");
      }
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams, sort],
  );

  const columns = React.useMemo(
    () => createRosterColumns({ sort, onSort: sortBy }),
    [sort, sortBy],
  );

  const table = useTable({
    features,
    data: data.rows,
    columns,
    getRowId: (row) => row.requestId,
  });

  function goToPage(page: number, pageSize: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", `${page}`);
    params.set("pageSize", `${pageSize}`);
    router.push(`${pathname}?${params.toString()}`);
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const filtered = ["status", "type", "site", "location"].some((key) => searchParams.has(key));
  const empty = query
    ? `No rosters match "${query}"`
    : filtered
      ? "No rosters match the filters"
      : "No approved requests yet";

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
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
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="md:hidden">
        <RosterCards rows={data.rows} empty={empty} />
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {data.total} {data.total === 1 ? "roster" : "rosters"}
        </div>
        <TablePagination
          page={data.page}
          pageSize={data.pageSize}
          pageCount={pageCount}
          onPageChange={(page) => goToPage(page, data.pageSize)}
          onPageSizeChange={(pageSize) => goToPage(1, pageSize)}
        />
      </div>
    </div>
  );
}
