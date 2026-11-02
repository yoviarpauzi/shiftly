import {
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
} from "@tanstack/react-table";
import Link from "next/link";
import {
  BanIcon,
  CheckIcon,
  EllipsisIcon,
  EyeIcon,
  XIcon,
} from "lucide-react";
import type {
  RequestActions,
  RequestRow,
  RequestSortColumn,
  RequestType,
} from "@/types/requests";
import type { SortControl } from "@/types/sort";
import {
  canCancelRequest,
  canDecideStatus,
  formatRequestDates,
} from "@/app/dashboard/requests/request-rules";
import { SortHeader } from "@/components/dashboard/sort-header";
import { RequestStatusBadge } from "@/components/dashboard/requests/request-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const features = tableFeatures({
  columnVisibilityFeature,
});

const columnHelper = createColumnHelper<typeof features, RequestRow>();

const TYPE_LABELS: Record<RequestType, string> = {
  daily: "Daily",
  weekly: "Weekly",
};

export function createRequestColumns(
  { onOpen, onCancel, onApprove, onReject }: RequestActions,
  { sort, onSort }: SortControl<RequestSortColumn>,
  canDecide: boolean,
) {
  return columnHelper.columns([
    columnHelper.accessor("poNumber", {
      header: () => (
        <SortHeader label="PO number" column="po" sort={sort} onSort={onSort} />
      ),
      cell: ({ row }) => (
        <Link
          href={`/dashboard/requests/${row.original.id}`}
          className="font-medium tabular-nums underline-offset-4 hover:underline"
        >
          {row.original.poNumber}
        </Link>
      ),
    }),
    columnHelper.accessor("type", {
      header: () => (
        <SortHeader label="Type" column="type" sort={sort} onSort={onSort} />
      ),
      cell: ({ row }) => TYPE_LABELS[row.original.type],
    }),
    columnHelper.accessor("startDate", {
      header: () => (
        <SortHeader label="Dates" column="date" sort={sort} onSort={onSort} />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatRequestDates(row.original.type, row.original.startDate)}
        </span>
      ),
    }),
    columnHelper.accessor("locationName", {
      header: () => (
        <SortHeader
          label="Location"
          column="location"
          sort={sort}
          onSort={onSort}
        />
      ),
      cell: ({ row }) => row.original.locationName,
    }),
    columnHelper.accessor("status", {
      header: () => (
        <SortHeader label="Status" column="status" sort={sort} onSort={onSort} />
      ),
      cell: ({ row }) => <RequestStatusBadge status={row.original.status} />,
    }),
    columnHelper.accessor("lineCount", {
      header: () => <span className="block text-right">Lines</span>,
      cell: ({ row }) => (
        <span className="block text-right tabular-nums">
          {row.original.lineCount}
        </span>
      ),
    }),
    columnHelper.accessor("createdByName", {
      header: () => <span>Created by</span>,
      cell: ({ row }) => row.original.createdByName,
    }),
    columnHelper.display({
      id: "actions",
      header: () => <span className="block text-right">Actions</span>,
      cell: ({ row }) => {
        const request = row.original;
        const decidable = canDecide && canDecideStatus(request.status);
        const cancellable = canCancelRequest(request.status);

        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Actions for ${request.poNumber}`}
                  />
                }
              >
                <EllipsisIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto min-w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => onOpen(request)}>
                    <EyeIcon />
                    Open
                  </DropdownMenuItem>
                  {decidable && (
                    <>
                      <DropdownMenuItem onClick={() => onApprove(request)}>
                        <CheckIcon />
                        Approve
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onReject(request)}
                      >
                        <XIcon />
                        Reject
                      </DropdownMenuItem>
                    </>
                  )}
                  {cancellable && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onCancel(request)}
                    >
                      <BanIcon />
                      Cancel
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableHiding: false,
    }),
  ]);
}
