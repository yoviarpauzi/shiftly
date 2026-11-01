"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type RowSelectionState, useTable } from "@tanstack/react-table";
import { PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { restoreLocation, restoreLocations } from "@/app/dashboard/locations/actions";
import {
  bulkRestoreMessage,
  bulkSelectionMode,
} from "@/app/dashboard/locations/location-rules";
import type {
  LocationPage,
  LocationRow,
  LocationStatus,
  SiteChoice,
} from "@/types/locations";
import { TablePagination } from "@/components/dashboard/pagination";
import { BulkDeleteLocationsDialog } from "@/components/dashboard/locations/bulk-delete-locations-dialog";
import {
  createLocationColumns,
  features,
} from "@/components/dashboard/locations/columns";
import { DeleteLocationDialog } from "@/components/dashboard/locations/delete-location-dialog";
import { LocationFormDialog } from "@/components/dashboard/locations/location-form-dialog";
import { LocationsSearch } from "@/components/dashboard/locations/locations-search";
import { LocationsStatusFilter } from "@/components/dashboard/locations/locations-status-filter";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

async function restoreWithToast(location: LocationRow) {
  const result = await restoreLocation(location.id);

  if (result.ok) {
    toast.success(`${location.name} restored`);
  } else {
    toast.error(result.formError ?? "Could not restore the location");
  }
}

export function LocationsDataTable({
  data,
  status,
  siteChoice,
}: {
  data: LocationPage;
  status: LocationStatus;
  siteChoice: SiteChoice;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [formOpen, setFormOpen] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);
  const [editingLocation, setEditingLocation] = React.useState<LocationRow | null>(null);
  const [deletingLocation, setDeletingLocation] = React.useState<LocationRow | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [bulkRestoring, setBulkRestoring] = React.useState(false);

  // A new key remounts the dialog, so each open starts from the right defaults.
  const openForm = React.useCallback((location: LocationRow | null) => {
    setEditingLocation(location);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }, []);

  const columns = React.useMemo(
    () =>
      createLocationColumns({
        onEdit: openForm,
        onDelete: setDeletingLocation,
        onRestore: restoreWithToast,
      }),
    [openForm],
  );

  // Only rows on the current page count, so a stale id is ignored.
  const selectedLocations = data.rows.filter((location) => rowSelection[location.id]);
  const selectionMode = bulkSelectionMode(selectedLocations);

  const table = useTable({
    features,
    data: data.rows,
    columns,
    getRowId: (row) => row.id,
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
  });

  function goToPage(page: number, pageSize: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", `${page}`);
    params.set("pageSize", `${pageSize}`);
    router.push(`${pathname}?${params.toString()}`);
  }

  // Clears the selection after a bulk action, so the rows that changed state are not left selected.
  async function handleBulkRestore() {
    setBulkRestoring(true);

    try {
      const result = await restoreLocations(selectedLocations.map((location) => location.id));
      const names = new Map(selectedLocations.map((location) => [location.id, location.name]));
      const message = bulkRestoreMessage(
        result.restoredIds.length,
        result.blocked.length,
      );

      if (result.blocked.length > 0) {
        const description = result.blocked
          .map((item) => `${names.get(item.id)}: ${item.formError}`)
          .join("\n");

        toast.error(message, { description });
      } else {
        toast.success(message);
      }

      setRowSelection({});
    } finally {
      setBulkRestoring(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LocationsSearch total={data.total} />
          <LocationsStatusFilter status={status} />
        </div>
        <Button onClick={() => openForm(null)}>
          <PlusIcon data-icon="inline-start" />
          Add location
        </Button>
      </div>
      {selectionMode !== "none" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted px-4 py-2">
          <div className="flex flex-col">
            <p className="text-sm font-medium">{selectedLocations.length} selected</p>
            {selectionMode === "mixed" && (
              <p className="text-sm text-muted-foreground">
                Select only active locations or only deleted locations.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectionMode !== "deleted" && (
              <Button
                variant="destructive"
                size="sm"
                disabled={selectionMode === "mixed"}
                onClick={() => setBulkDeleting(true)}
              >
                <Trash2Icon data-icon="inline-start" />
                Delete selected
              </Button>
            )}
            {selectionMode !== "active" && (
              <Button
                variant="outline"
                size="sm"
                disabled={selectionMode === "mixed" || bulkRestoring}
                onClick={handleBulkRestore}
              >
                <RotateCcwIcon data-icon="inline-start" />
                Restore selected
              </Button>
            )}
          </div>
        </div>
      )}
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
                <TableRow
                  key={row.id}
                  className={
                    row.original.deletedAt ? "text-muted-foreground" : undefined
                  }
                >
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
                    ? `No locations match "${query}"`
                    : status === "deleted"
                      ? "No deleted locations"
                      : "No locations yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {data.total} {data.total === 1 ? "location" : "locations"}
        </div>
        <TablePagination
          page={data.page}
          pageCount={pageCount}
          pageSize={data.pageSize}
          onPageChange={(page) => goToPage(page, data.pageSize)}
          onPageSizeChange={(pageSize) => goToPage(1, pageSize)}
        />
      </div>
      <LocationFormDialog
        key={formKey}
        location={editingLocation}
        siteChoice={siteChoice}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
      <BulkDeleteLocationsDialog
        locations={selectedLocations}
        open={bulkDeleting}
        onOpenChange={setBulkDeleting}
        onComplete={() => setRowSelection({})}
      />
      <DeleteLocationDialog
        location={deletingLocation}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingLocation(null);
          }
        }}
      />
    </div>
  );
}
