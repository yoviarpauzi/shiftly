import {
  columnVisibilityFeature,
  createColumnHelper,
  rowSelectionFeature,
  tableFeatures,
} from "@tanstack/react-table";
import type { LocationRow } from "@/types/locations";
import { Badge } from "@/components/ui/badge";

export const features = tableFeatures({
  columnVisibilityFeature,
  rowSelectionFeature,
});

const columnHelper = createColumnHelper<typeof features, LocationRow>();

export function createLocationColumns() {
  return columnHelper.columns([
    columnHelper.accessor("name", {
      header: "Name",
      cell: ({ row }) => row.original.name,
    }),
    columnHelper.accessor("siteName", {
      header: "Site",
      cell: ({ row }) => row.original.siteName,
    }),
    columnHelper.accessor("deletedAt", {
      header: () => <span className="block pl-8">Status</span>,
      cell: ({ row }) => (
        <div className="pl-8">
          <Badge variant="outline">
            <span
              aria-hidden
              className={`size-2 rounded-full ${row.original.deletedAt ? "bg-destructive" : "bg-accent-text"}`}
            />
            {row.original.deletedAt ? "Deleted" : "Active"}
          </Badge>
        </div>
      ),
    }),
  ]);
}
