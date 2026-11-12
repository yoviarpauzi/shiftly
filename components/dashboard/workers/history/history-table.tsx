"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTable } from "@tanstack/react-table";
import { oppositeDirection } from "@/app/dashboard/workers/worker-history-rules";
import { serializeSort } from "@/validation/sort";
import type { HistorySortColumn, HistoryTableProps } from "@/types/worker-history";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createHistoryColumns, features } from "./columns";

export function HistoryTable({ data, sort }: HistoryTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // A header click flips the order in the URL, so the server sorts the rows. Date is the only sort
  // and newest first is its default, so it is a two-state toggle. The page goes back to 1.
  const sortBy = React.useCallback(
    (column: HistorySortColumn) => {
      const direction = oppositeDirection(sort[0]?.direction ?? "desc");
      const params = new URLSearchParams(searchParams.toString());

      params.set("sort", serializeSort([{ column, direction }]));
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams, sort],
  );

  const columns = React.useMemo(
    () => createHistoryColumns({ sort, onSort: sortBy }),
    [sort, sortBy],
  );

  const table = useTable({
    features,
    data: data.rows,
    columns,
    getRowId: (row) => row.assignmentId,
  });

  return (
    <div className="overflow-hidden rounded-lg border">
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
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
