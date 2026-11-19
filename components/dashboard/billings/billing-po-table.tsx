"use client";

import { useTable } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BillingPoTableProps } from "@/types/billings";
import { billingLineColumns, billingLineFeatures } from "./billing-line-columns";

// One purchase order: its lines, then the subtotal of its days.
export function BillingPoTable({ group }: BillingPoTableProps) {
  const table = useTable({
    features: billingLineFeatures,
    data: group.lines,
    columns: billingLineColumns,
    getRowId: (row) => `${row.departmentId}|${row.subDepartmentId ?? ""}|${row.positionId}`,
  });

  return (
    <section aria-labelledby={`po-${group.requestId}`} className="flex flex-col gap-2">
      <h2 id={`po-${group.requestId}`} className="text-base font-semibold break-all">
        {group.poNumber}
      </h2>
      <div className="overflow-x-auto rounded-lg border">
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
          <TableFooter>
            <TableRow>
              <TableCell colSpan={billingLineColumns.length - 1} className="font-medium">
                Subtotal
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{group.subtotal}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </section>
  );
}
