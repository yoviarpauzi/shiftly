"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTable } from "@tanstack/react-table";
import { PlusIcon } from "lucide-react";
import type { BillingsDataTableProps } from "@/types/billings";
import {
  createBillingColumns,
  features,
} from "@/components/dashboard/billings/columns";
import { TablePagination } from "@/components/dashboard/pagination";
import {
  SelectFilter,
  type FilterOption,
} from "@/components/dashboard/select-filter";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_OPTIONS: FilterOption[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "void", label: "Void" },
];

export function BillingsDataTable({
  data,
  status,
  pickSite,
  siteId,
  sites,
  pickLocation,
  locationId,
  locations,
}: BillingsDataTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const columns = React.useMemo(() => createBillingColumns(), []);

  const table = useTable({
    features,
    data: data.rows,
    columns,
    getRowId: (row) => row.id,
  });

  const siteOptions: FilterOption[] = [
    { value: "all", label: "All sites" },
    ...sites.map((site) => ({ value: site.id, label: site.name })),
  ];
  const locationOptions: FilterOption[] = [
    { value: "all", label: "All locations" },
    ...locations.map((location) => ({
      value: location.id,
      label: location.name,
    })),
  ];

  function goToPage(page: number, pageSize: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", `${page}`);
    params.set("pageSize", `${pageSize}`);
    router.push(`${pathname}?${params.toString()}`);
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const filtered = status !== "all" || siteId !== null || locationId !== null;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SelectFilter
            param="status"
            value={status}
            options={STATUS_OPTIONS}
            ariaLabel="Filter billings by status"
            className="h-9 w-40"
          />
          {pickSite && (
            <SelectFilter
              param="site"
              value={siteId ?? "all"}
              options={siteOptions}
              ariaLabel="Filter billings by site"
              className="h-9 w-48"
              resets={["location"]}
            />
          )}
          {pickLocation && (!pickSite || siteId !== null) && (
            <SelectFilter
              param="location"
              value={locationId ?? "all"}
              options={locationOptions}
              ariaLabel="Filter billings by location"
              className="h-9 w-48"
            />
          )}
        </div>
        <Link href="/dashboard/billings/new" className={buttonVariants()}>
          <PlusIcon data-icon="inline-start" />
          New billing
        </Link>
      </div>
      <div className="overflow-x-auto rounded-lg border">
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
                  {filtered ? "No billings match the filters" : "No billings yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {data.total} {data.total === 1 ? "billing" : "billings"}
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
