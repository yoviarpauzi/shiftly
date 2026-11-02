"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type RowSelectionState, useTable } from "@tanstack/react-table";
import { DownloadIcon, PlusIcon, RotateCcwIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { bulkSelectionMode } from "@/app/dashboard/departments/department-rules";
import { restoreWorker, restoreWorkers } from "@/app/dashboard/workers/actions";
import { bulkWorkerRestoreMessage } from "@/app/dashboard/workers/worker-rules";
import { nextSort } from "@/lib/sort";
import { serializeSort } from "@/validation/sort";
import type { SortCriterion } from "@/types/sort";
import type {
  WorkerFormOption,
  WorkerFormOptions,
  WorkerPage,
  WorkerRow,
  WorkerSortColumn,
  WorkerStatus,
} from "@/types/workers";
import { TablePagination } from "@/components/dashboard/pagination";
import { BulkDeleteWorkersDialog } from "@/components/dashboard/workers/bulk-delete-workers-dialog";
import { createWorkerColumns, features } from "@/components/dashboard/workers/columns";
import { DeleteWorkerDialog } from "@/components/dashboard/workers/delete-worker-dialog";
import { ImportWorkersDialog } from "@/components/dashboard/workers/import-workers-dialog";
import { WorkerFormDialog } from "@/components/dashboard/workers/worker-form-dialog";
import { WorkersPositionFilter } from "@/components/dashboard/workers/workers-position-filter";
import { WorkersSearch } from "@/components/dashboard/workers/workers-search";
import { WorkersSelectFilter } from "@/components/dashboard/workers/workers-select-filter";
import { WorkersStatusFilter } from "@/components/dashboard/workers/workers-status-filter";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const IMPORT_TEMPLATE_URL = "/dashboard/workers/import/template";

async function restoreWithToast(worker: WorkerRow) {
  const result = await restoreWorker(worker.id);

  if (result.ok) {
    toast.success(`${worker.name} restored`);
  } else {
    toast.error(result.formError ?? "Could not restore the worker");
  }
}

export function WorkersDataTable({
  data,
  status,
  sort,
  options,
  siteId,
  locations,
  locationId,
  positions,
  positionId,
}: {
  data: WorkerPage;
  status: WorkerStatus;
  sort: SortCriterion<WorkerSortColumn>[];
  options: WorkerFormOptions;
  siteId: string | null;
  locations: WorkerFormOption[];
  locationId: string | null;
  positions: WorkerFormOption[];
  positionId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [formOpen, setFormOpen] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importKey, setImportKey] = React.useState(0);
  const [editingWorker, setEditingWorker] = React.useState<WorkerRow | null>(null);
  const [deletingWorker, setDeletingWorker] = React.useState<WorkerRow | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [bulkRestoring, setBulkRestoring] = React.useState(false);

  // A new key remounts the dialog, so each open starts from the right defaults.
  const openForm = React.useCallback((worker: WorkerRow | null) => {
    setEditingWorker(worker);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }, []);

  // A new key remounts the dialog, so each open starts without the last file.
  const openImport = React.useCallback(() => {
    setImportKey((key) => key + 1);
    setImportOpen(true);
  }, []);

  // A header click changes the URL, so the server sorts the page. The page goes back to 1.
  const sortBy = React.useCallback(
    (column: WorkerSortColumn, shift: boolean) => {
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
      createWorkerColumns(
        {
          onEdit: openForm,
          onDelete: setDeletingWorker,
          onRestore: restoreWithToast,
        },
        { sort, onSort: sortBy },
      ),
    [openForm, sort, sortBy],
  );

  // Only rows on the current page count, so a stale id is ignored.
  const selectedWorkers = data.rows.filter((worker) => rowSelection[worker.id]);
  const selectionMode = bulkSelectionMode(selectedWorkers);

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
      const result = await restoreWorkers(selectedWorkers.map((worker) => worker.id));
      const names = new Map(selectedWorkers.map((worker) => [worker.id, worker.name]));
      const message = bulkWorkerRestoreMessage(result.restoredIds.length, result.blocked.length);

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
        <div className="flex flex-wrap items-center gap-2">
          <WorkersSearch />
          <WorkersStatusFilter status={status} />
          {options.siteChoice.mode === "pick" && (
            <WorkersSelectFilter
              param="site"
              value={siteId ?? "all"}
              options={[
                { value: "all", label: "All sites" },
                ...options.siteChoice.sites.map((site) => ({ value: site.id, label: site.name })),
              ]}
              ariaLabel="Filter workers by site"
              className="h-9 w-48"
              resets={["location", "position"]}
            />
          )}
          {locations.length > 0 && (
            <WorkersSelectFilter
              param="location"
              value={locationId ?? "all"}
              options={[
                { value: "all", label: "All locations" },
                ...locations.map((location) => ({ value: location.id, label: location.name })),
              ]}
              ariaLabel="Filter workers by location"
              className="h-9 w-48"
            />
          )}
          {positions.length > 0 && (
            <WorkersPositionFilter positions={positions} value={positionId} />
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={IMPORT_TEMPLATE_URL}
            download
            className={buttonVariants({ variant: "outline" })}
          >
            <DownloadIcon data-icon="inline-start" />
            Template
          </a>
          <Button variant="outline" onClick={openImport}>
            <UploadIcon data-icon="inline-start" />
            Import
          </Button>
          <Button onClick={() => openForm(null)}>
            <PlusIcon data-icon="inline-start" />
            Add worker
          </Button>
        </div>
      </div>
      {selectionMode !== "none" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted px-4 py-2">
          <div className="flex flex-col">
            <p className="text-sm font-medium">{selectedWorkers.length} selected</p>
            {selectionMode === "mixed" && (
              <p className="text-sm text-muted-foreground">
                Select only active workers or only deleted workers.
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
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
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
                  className={row.original.deletedAt ? "text-muted-foreground" : undefined}
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
                    ? `No workers match "${query}"`
                    : siteId || locationId || positionId
                      ? "No workers match the filters"
                      : status === "deleted"
                        ? "No deleted workers"
                        : "No workers yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {data.total} {data.total === 1 ? "worker" : "workers"}
        </div>
        <TablePagination
          page={data.page}
          pageSize={data.pageSize}
          pageCount={pageCount}
          onPageChange={(page) => goToPage(page, data.pageSize)}
          onPageSizeChange={(pageSize) => goToPage(1, pageSize)}
        />
      </div>
      <WorkerFormDialog
        key={formKey}
        worker={editingWorker}
        options={options}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
      {/* The prefix keeps this key apart from formKey, since both counters start at 0 and share a parent. */}
      <ImportWorkersDialog
        key={`import-${importKey}`}
        open={importOpen}
        onOpenChange={setImportOpen}
      />
      <BulkDeleteWorkersDialog
        workers={selectedWorkers}
        open={bulkDeleting}
        onOpenChange={setBulkDeleting}
        onComplete={() => setRowSelection({})}
      />
      <DeleteWorkerDialog
        worker={deletingWorker}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingWorker(null);
          }
        }}
      />
    </div>
  );
}
