import {
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
} from "@tanstack/react-table";

import { RequestStatusBadge } from "@/components/dashboard/requests/request-status-badge";
import { formatRequestDates } from "@/app/dashboard/requests/request-rules";
import { cn } from "@/lib/utils";
import type {
  CountCellProps,
  LocationRow,
  NumberHeaderProps,
  RecentRequestRow,
  SiteRow,
} from "@/types/dashboard";

// The summary tables only list rows, so no sorting, filtering or pagination feature is loaded.
// Column visibility is what gives a row its visible cells.
export const summaryFeatures = tableFeatures({ columnVisibilityFeature });

const REQUEST_TYPE_LABELS = { weekly: "Weekly", daily: "Daily" } as const;

// The number alone says whether something needs attention: zeros are muted, a conflict is red.
function CountCell({ value, danger = false }: CountCellProps) {
  return (
    <div
      className={cn(
        "text-right tabular-nums",
        value === 0 && "text-muted-foreground",
        danger && value > 0 && "text-destructive",
      )}
    >
      {value}
    </div>
  );
}

function NumberHeader({ label }: NumberHeaderProps) {
  return <div className="text-right">{label}</div>;
}

const siteHelper = createColumnHelper<typeof summaryFeatures, SiteRow>();
const locationHelper = createColumnHelper<typeof summaryFeatures, LocationRow>();
const requestHelper = createColumnHelper<typeof summaryFeatures, RecentRequestRow>();

export const siteColumns = siteHelper.columns([
  siteHelper.accessor("name", { header: "Site" }),
  siteHelper.accessor("locations", {
    header: () => <NumberHeader label="Locations" />,
    cell: ({ row }) => <CountCell value={row.original.locations} />,
  }),
  siteHelper.accessor("workers", {
    header: () => <NumberHeader label="Workers" />,
    cell: ({ row }) => <CountCell value={row.original.workers} />,
  }),
  siteHelper.accessor("pendingRequests", {
    header: () => <NumberHeader label="Pending requests" />,
    cell: ({ row }) => <CountCell value={row.original.pendingRequests} />,
  }),
  siteHelper.accessor("draftRosters", {
    header: () => <NumberHeader label="Draft rosters" />,
    cell: ({ row }) => <CountCell value={row.original.draftRosters} />,
  }),
  siteHelper.accessor("conflicts", {
    header: () => <NumberHeader label="Conflicts" />,
    cell: ({ row }) => <CountCell value={row.original.conflicts} danger />,
  }),
]);

export const locationColumns = locationHelper.columns([
  locationHelper.accessor("name", { header: "Location" }),
  locationHelper.accessor("workers", {
    header: () => <NumberHeader label="Workers" />,
    cell: ({ row }) => <CountCell value={row.original.workers} />,
  }),
  locationHelper.accessor("pendingRequests", {
    header: () => <NumberHeader label="Pending requests" />,
    cell: ({ row }) => <CountCell value={row.original.pendingRequests} />,
  }),
  locationHelper.accessor("draftRosters", {
    header: () => <NumberHeader label="Draft rosters" />,
    cell: ({ row }) => <CountCell value={row.original.draftRosters} />,
  }),
  locationHelper.accessor("conflicts", {
    header: () => <NumberHeader label="Conflicts" />,
    cell: ({ row }) => <CountCell value={row.original.conflicts} danger />,
  }),
]);

export const requestColumns = requestHelper.columns([
  requestHelper.accessor("poNumber", { header: "PO number" }),
  requestHelper.accessor("type", {
    header: "Type",
    cell: ({ row }) => REQUEST_TYPE_LABELS[row.original.type],
  }),
  requestHelper.display({
    id: "dates",
    header: "Dates",
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatRequestDates(row.original.type, row.original.startDate)}
      </span>
    ),
  }),
  requestHelper.accessor("status", {
    header: "Status",
    cell: ({ row }) => <RequestStatusBadge status={row.original.status} />,
  }),
]);
