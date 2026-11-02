"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTable } from "@tanstack/react-table";
import { PlusIcon } from "lucide-react";
import { nextSort } from "@/lib/sort";
import { serializeSort } from "@/validation/sort";
import type {
  RequestRow,
  RequestSortColumn,
  RequestsDataTableProps,
} from "@/types/requests";
import { TablePagination } from "@/components/dashboard/pagination";
import { ApproveRequestDialog } from "@/components/dashboard/requests/approve-request-dialog";
import { CancelRequestDialog } from "@/components/dashboard/requests/cancel-request-dialog";
import {
  createRequestColumns,
  features,
} from "@/components/dashboard/requests/columns";
import { RejectRequestDialog } from "@/components/dashboard/requests/reject-request-dialog";
import { RequestsLocationFilter } from "@/components/dashboard/requests/requests-location-filter";
import { RequestsSearch } from "@/components/dashboard/requests/requests-search";
import { RequestsStatusFilter } from "@/components/dashboard/requests/requests-status-filter";
import { RequestsTypeFilter } from "@/components/dashboard/requests/requests-type-filter";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function RequestsDataTable({
  data,
  status,
  type,
  locationId,
  locations,
  sort,
  canDecide,
}: RequestsDataTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [cancelling, setCancelling] = React.useState<RequestRow | null>(null);
  const [approving, setApproving] = React.useState<RequestRow | null>(null);
  const [rejecting, setRejecting] = React.useState<RequestRow | null>(null);

  // A header click changes the URL, so the server sorts the page. The page goes back to 1.
  const sortBy = React.useCallback(
    (column: RequestSortColumn, shift: boolean) => {
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
    () =>
      createRequestColumns(
        {
          onOpen: (request) => router.push(`${pathname}/${request.id}`),
          onCancel: setCancelling,
          onApprove: setApproving,
          onReject: setRejecting,
        },
        { sort, onSort: sortBy },
        canDecide,
      ),
    [canDecide, pathname, router, sort, sortBy],
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
  const filtered = status !== "all" || type !== "all" || locationId !== null;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <RequestsSearch />
          <RequestsStatusFilter status={status} />
          <RequestsTypeFilter type={type} />
          {locations.length > 1 && (
            <RequestsLocationFilter
              locationId={locationId}
              locations={locations}
            />
          )}
        </div>
        <Link href="/dashboard/requests/new" className={buttonVariants()}>
          <PlusIcon data-icon="inline-start" />
          New request
        </Link>
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
                  {query
                    ? `No requests match "${query}"`
                    : filtered
                      ? "No requests match the filters"
                      : "No requests yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {data.total} {data.total === 1 ? "request" : "requests"}
        </div>
        <TablePagination
          page={data.page}
          pageSize={data.pageSize}
          pageCount={pageCount}
          onPageChange={(page) => goToPage(page, data.pageSize)}
          onPageSizeChange={(pageSize) => goToPage(1, pageSize)}
        />
      </div>
      <CancelRequestDialog
        request={cancelling}
        onOpenChange={(open) => {
          if (!open) {
            setCancelling(null);
          }
        }}
      />
      <ApproveRequestDialog
        request={approving}
        onOpenChange={(open) => {
          if (!open) {
            setApproving(null);
          }
        }}
      />
      <RejectRequestDialog
        request={rejecting}
        onOpenChange={(open) => {
          if (!open) {
            setRejecting(null);
          }
        }}
      />
    </div>
  );
}
