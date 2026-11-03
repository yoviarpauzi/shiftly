import { columnVisibilityFeature, createColumnHelper, tableFeatures } from "@tanstack/react-table";
import type { ImportRowResult } from "@/types/worker-import";
import { Badge } from "@/components/ui/badge";

export const importFeatures = tableFeatures({ columnVisibilityFeature });

const columnHelper = createColumnHelper<typeof importFeatures, ImportRowResult>();

const ACTION_BADGES = {
  create: { variant: "secondary", label: "Create" },
  update: { variant: "outline", label: "Update" },
  error: { variant: "destructive", label: "Error" },
} as const;

export function createImportColumns() {
  return columnHelper.columns([
    columnHelper.accessor("rowNumber", {
      header: () => <span>Row</span>,
      cell: ({ row }) => row.original.rowNumber,
    }),
    columnHelper.display({
      id: "action",
      header: () => <span>Action</span>,
      cell: ({ row }) => {
        const badge = ACTION_BADGES[row.original.action];

        return <Badge variant={badge.variant}>{badge.label}</Badge>;
      },
    }),
    columnHelper.accessor("employeeId", {
      header: () => <span>Employee ID</span>,
      cell: ({ row }) => <span className="font-medium">{row.original.employeeId}</span>,
    }),
    columnHelper.accessor("name", {
      header: () => <span>Name</span>,
      cell: ({ row }) => row.original.name,
    }),
    columnHelper.accessor("siteName", {
      header: () => <span>Site</span>,
      cell: ({ row }) => row.original.siteName,
    }),
    columnHelper.accessor("locationName", {
      header: () => <span>Location</span>,
      cell: ({ row }) => row.original.locationName,
    }),
    columnHelper.display({
      id: "positions",
      header: () => <span>Positions</span>,
      cell: ({ row }) =>
        row.original.positionNames.length > 0 ? (
          row.original.positionNames.join(", ")
        ) : (
          <span className="text-muted-foreground">None</span>
        ),
    }),
    columnHelper.accessor("endContract", {
      header: () => <span>Contract end</span>,
      cell: ({ row }) => row.original.endContract,
    }),
    columnHelper.accessor("workDays", {
      header: () => <span>Working days</span>,
      cell: ({ row }) =>
        row.original.workDays ?? <span className="text-muted-foreground">Inherited</span>,
    }),
    columnHelper.display({
      id: "issues",
      header: () => <span>Issues</span>,
      cell: ({ row }) => (
        <span className="text-destructive">{row.original.errors.join("; ")}</span>
      ),
    }),
  ]);
}
