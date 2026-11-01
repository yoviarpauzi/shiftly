"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTable } from "@tanstack/react-table";
import { nextSort } from "@/lib/sort";
import { serializeSort } from "@/validation/sort";
import type { SortCriterion } from "@/types/sort";
import type {
  DepartmentLocationChoice,
  DepartmentPage,
  DepartmentSortColumn,
  DepartmentStatus,
} from "@/types/departments";
import { TablePagination } from "@/components/dashboard/pagination";
import {
  createDepartmentColumns,
  features,
} from "@/components/dashboard/departments/columns";
import { DepartmentsLocationFilter } from "@/components/dashboard/departments/departments-location-filter";
import { DepartmentsSearch } from "@/components/dashboard/departments/departments-search";
import { DepartmentsStatusFilter } from "@/components/dashboard/departments/departments-status-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DepartmentsDataTable({
  data,
  status,
  locationId,
  locationChoice,
  sort,
}: {
  data: DepartmentPage;
  status: DepartmentStatus;
  locationId: string | null;
  locationChoice: DepartmentLocationChoice;
  sort: SortCriterion<DepartmentSortColumn>[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  // A header click changes the URL, so the server sorts the page. The page goes back to 1.
  const sortBy = React.useCallback(
    (column: DepartmentSortColumn, shift: boolean) => {
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
    () => createDepartmentColumns({ sort, onSort: sortBy }),
    [sort, sortBy],
  );

  const table = useTable({
    features,
    data: data.rows,
    columns,
    getRowId: (row) => row.id,
  });

  function goToPage(page: number, pageSize: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", `${page}`);
    params.set("pageSize", `${pageSize}`);
    router.push(`${pathname}?${params.toString()}`);
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DepartmentsSearch total={data.total} />
          <DepartmentsStatusFilter status={status} />
          {locationChoice.mode === "pick" && (
            <DepartmentsLocationFilter
              locationId={locationId}
              locations={locationChoice.locations}
            />
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={
                    row.original.deletedAt ? "text-muted-foreground" : undefined
                  }
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
                  {query
                    ? `No departments match "${query}"`
                    : status === "deleted"
                      ? "No deleted departments"
                      : "No departments yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {data.total} {data.total === 1 ? "department" : "departments"}
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
