import {
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
} from "@tanstack/react-table";
import Link from "next/link";
import {
  formatBillingIssuedAt,
  formatBillingPeriod,
} from "@/app/dashboard/billings/billing-rules";
import type { BillingMode, BillingRow } from "@/types/billings";
import { BillingStatusBadge } from "@/components/dashboard/billings/billing-status-badge";

export const features = tableFeatures({
  columnVisibilityFeature,
});

const columnHelper = createColumnHelper<typeof features, BillingRow>();

const MODE_LABELS: Record<BillingMode, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
  custom: "Custom",
};

export function createBillingColumns() {
  return columnHelper.columns([
    columnHelper.accessor("number", {
      header: () => <span>Number</span>,
      cell: ({ row }) => (
        <Link
          href={`/dashboard/billings/${row.original.id}`}
          className="font-medium tabular-nums underline-offset-4 hover:underline"
        >
          {row.original.number ?? (
            <>
              Draft
              <span className="sr-only"> billing for {row.original.locationName}</span>
            </>
          )}
        </Link>
      ),
    }),
    columnHelper.accessor("locationName", {
      header: () => <span>Location</span>,
      cell: ({ row }) => row.original.locationName,
    }),
    columnHelper.accessor("periodStart", {
      header: () => <span>Period</span>,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatBillingPeriod(row.original.periodStart, row.original.periodEnd)}
        </span>
      ),
    }),
    columnHelper.accessor("mode", {
      header: () => <span>Mode</span>,
      cell: ({ row }) => MODE_LABELS[row.original.mode],
    }),
    columnHelper.accessor("status", {
      header: () => <span>Status</span>,
      cell: ({ row }) => <BillingStatusBadge status={row.original.status} />,
    }),
    columnHelper.accessor("totalDays", {
      header: () => <span className="block text-right">Total days</span>,
      cell: ({ row }) => (
        <span className="block text-right tabular-nums">
          {row.original.totalDays ?? "-"}
        </span>
      ),
    }),
    columnHelper.accessor("issuedAt", {
      header: () => <span>Issued at</span>,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatBillingIssuedAt(row.original.issuedAt)}
        </span>
      ),
    }),
  ]);
}
