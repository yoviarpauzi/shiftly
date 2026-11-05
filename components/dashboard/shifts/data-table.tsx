"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type RowSelectionState, useTable } from "@tanstack/react-table";
import { PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { bulkSelectionMode } from "@/app/dashboard/departments/department-rules";
import {
  restoreShift,
  restoreShifts,
} from "@/app/dashboard/shifts/actions";
import { bulkShiftRestoreMessage } from "@/app/dashboard/shifts/shift-rules";
import { nextSort } from "@/lib/sort";
import { serializeSort } from "@/validation/sort";
import type { SortCriterion } from "@/types/sort";
import type { SiteOption } from "@/types/locations";
import type {
  ShiftLocationChoice,
  ShiftLocationOption,
  ShiftPage,
  ShiftRow,
  ShiftSortColumn,
  ShiftStatus,
} from "@/types/shifts";
import { TablePagination } from "@/components/dashboard/pagination";
import { SelectFilter } from "@/components/dashboard/select-filter";
import { BulkDeleteShiftsDialog } from "@/components/dashboard/shifts/bulk-delete-shifts-dialog";
import {
  createShiftColumns,
  features,
} from "@/components/dashboard/shifts/columns";
import { DeleteShiftDialog } from "@/components/dashboard/shifts/delete-shift-dialog";
import { ShiftFormDialog } from "@/components/dashboard/shifts/shift-form-dialog";
import { ShiftsSearch } from "@/components/dashboard/shifts/shifts-search";
import { ShiftsStatusFilter } from "@/components/dashboard/shifts/shifts-status-filter";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

async function restoreWithToast(shift: ShiftRow) {
  const result = await restoreShift(shift.id);

  if (result.ok) {
    toast.success(`${shift.name} restored`);
  } else {
    toast.error(result.formError ?? "Could not restore the shift");
  }
}

export function ShiftsDataTable({
  data,
  status,
  sites,
  siteId,
  locations,
  locationId,
  locationChoice,
  sort,
}: {
  data: ShiftPage;
  status: ShiftStatus;
  // null when the actor has no site to pick, which is every role except superadmin.
  sites: SiteOption[] | null;
  siteId: string | null;
  // The locations the location filter lists.
  locations: ShiftLocationOption[];
  locationId: string | null;
  locationChoice: ShiftLocationChoice;
  sort: SortCriterion<ShiftSortColumn>[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [formOpen, setFormOpen] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);
  const [editingShift, setEditingShift] = React.useState<ShiftRow | null>(null);
  const [deletingShift, setDeletingShift] = React.useState<ShiftRow | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [bulkRestoring, setBulkRestoring] = React.useState(false);

  // A new key remounts the dialog, so each open starts from the right defaults.
  const openForm = React.useCallback((shift: ShiftRow | null) => {
    setEditingShift(shift);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }, []);

  // A header click changes the URL, so the server sorts the page. The page goes back to 1.
  const sortBy = React.useCallback(
    (column: ShiftSortColumn, shift: boolean) => {
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
      createShiftColumns(
        {
          onEdit: openForm,
          onDelete: setDeletingShift,
          onRestore: restoreWithToast,
        },
        { sort, onSort: sortBy },
      ),
    [openForm, sort, sortBy],
  );

  // Only rows on the current page count, so a stale id is ignored.
  const selectedShifts = data.rows.filter((shift) => rowSelection[shift.id]);
  const selectionMode = bulkSelectionMode(selectedShifts);

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
      const result = await restoreShifts(selectedShifts.map((shift) => shift.id));
      const names = new Map(selectedShifts.map((shift) => [shift.id, shift.name]));
      const message = bulkShiftRestoreMessage(
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
          <ShiftsSearch />
          <ShiftsStatusFilter status={status} />
          {sites && (
            <SelectFilter
              param="site"
              value={siteId ?? "all"}
              options={[
                { value: "all", label: "All sites" },
                ...sites.map((site) => ({ value: site.id, label: site.name })),
              ]}
              ariaLabel="Filter shifts by site"
              className="h-9 w-48"
              resets={["location"]}
            />
          )}
          {locationChoice.mode === "pick" && (!sites || siteId !== null) && (
            <SelectFilter
              param="location"
              value={locationId ?? "all"}
              options={[
                { value: "all", label: "All locations" },
                ...locations.map((location) => ({
                  value: location.id,
                  label: location.name,
                })),
              ]}
              ariaLabel="Filter shifts by location"
              className="h-9 w-48"
            />
          )}
        </div>
        <Button onClick={() => openForm(null)}>
          <PlusIcon data-icon="inline-start" />
          Add shift
        </Button>
      </div>
      {selectionMode !== "none" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted px-4 py-2">
          <div className="flex flex-col">
            <p className="text-sm font-medium">{selectedShifts.length} selected</p>
            {selectionMode === "mixed" && (
              <p className="text-sm text-muted-foreground">
                Select only active shifts or only deleted shifts.
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
                    ? `No shifts match "${query}"`
                    : status === "deleted"
                      ? "No deleted shifts"
                      : "No shifts yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {data.total} {data.total === 1 ? "shift" : "shifts"}
        </div>
        <TablePagination
          page={data.page}
          pageSize={data.pageSize}
          pageCount={pageCount}
          onPageChange={(page) => goToPage(page, data.pageSize)}
          onPageSizeChange={(pageSize) => goToPage(1, pageSize)}
        />
      </div>
      <ShiftFormDialog
        key={formKey}
        shift={editingShift}
        locationChoice={locationChoice}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
      <BulkDeleteShiftsDialog
        shifts={selectedShifts}
        open={bulkDeleting}
        onOpenChange={setBulkDeleting}
        onComplete={() => setRowSelection({})}
      />
      <DeleteShiftDialog
        shift={deletingShift}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingShift(null);
          }
        }}
      />
    </div>
  );
}
