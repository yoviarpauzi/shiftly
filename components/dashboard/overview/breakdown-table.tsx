"use client";

import { type RowData, useTable } from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  BreakdownTableProps,
  IdentifiedRow,
  SummaryTableProps,
} from "@/types/dashboard";
import {
  locationColumns,
  requestColumns,
  siteColumns,
  summaryFeatures,
} from "./columns";

function SummaryTable<TData extends RowData>({ data, columns, getRowId }: SummaryTableProps<TData>) {
  const table = useTable({ features: summaryFeatures, data, columns, getRowId });

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} colSpan={header.colSpan}>
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
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                Nothing to show yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function rowId(row: IdentifiedRow) {
  return row.id;
}

export function BreakdownTable({ breakdown, contextName }: BreakdownTableProps) {
  let title: string;
  let subtitle: string;
  let body: React.ReactNode;

  switch (breakdown.kind) {
    case "sites":
      title = "By site";
      subtitle = "How each site is doing right now.";
      body = <SummaryTable data={breakdown.rows} columns={siteColumns} getRowId={rowId} />;
      break;
    case "locations":
      title = "By location";
      subtitle = `How each location${contextName ? ` of ${contextName}` : ""} is doing right now.`;
      body = <SummaryTable data={breakdown.rows} columns={locationColumns} getRowId={rowId} />;
      break;
    case "requests":
      title = "Recent requests";
      subtitle = `Requests${contextName ? ` for ${contextName}` : ""}, newest first.`;
      body = <SummaryTable data={breakdown.rows} columns={requestColumns} getRowId={rowId} />;
      break;
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {body}
    </section>
  );
}
