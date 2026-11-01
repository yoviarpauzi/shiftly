"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTable } from "@tanstack/react-table";
import { TablePagination } from "@/components/dashboard/pagination";
import {
  createLocationColumns,
  features,
} from "@/components/dashboard/locations/columns";
import { LocationsSearch } from "@/components/dashboard/locations/locations-search";
import { LocationsStatusFilter } from "@/components/dashboard/locations/locations-status-filter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LocationPage, LocationStatus } from "@/types/locations";

export function LocationsDataTable({
  data,
  status,
}: {
  data: LocationPage;
  status: LocationStatus;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const columns = React.useMemo(() => createLocationColumns(), []);

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
      <div className="flex items-center gap-2">
        <LocationsSearch total={data.total} />
        <LocationsStatusFilter status={status} />
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
                    ? `No locations match "${query}"`
                    : status === "deleted"
                      ? "No deleted locations"
                      : "No locations yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {data.total} {data.total === 1 ? "location" : "locations"}
        </div>
        <TablePagination
          page={data.page}
          pageCount={pageCount}
          pageSize={data.pageSize}
          onPageChange={(page) => goToPage(page, data.pageSize)}
          onPageSizeChange={(pageSize) => goToPage(1, pageSize)}
        />
      </div>
    </div>
  );
}
