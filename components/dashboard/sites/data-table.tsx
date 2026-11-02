"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type RowSelectionState, useTable } from "@tanstack/react-table";
import { PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { restoreSite, restoreSites } from "@/app/dashboard/sites/actions";
import {
  bulkRestoreMessage,
  bulkSelectionMode,
} from "@/app/dashboard/sites/site-rules";
import { nextSort } from "@/lib/sort";
import { serializeSort } from "@/validation/sort";
import type { SortCriterion } from "@/types/sort";
import type { SitePage, SiteRow, SiteSortColumn, SiteStatus } from "@/types/sites";
import { TablePagination } from "@/components/dashboard/pagination";
import { BulkDeleteSitesDialog } from "@/components/dashboard/sites/bulk-delete-sites-dialog";
import { createSiteColumns, features } from "@/components/dashboard/sites/columns";
import { DeleteSiteDialog } from "@/components/dashboard/sites/delete-site-dialog";
import { SiteFormDialog } from "@/components/dashboard/sites/site-form-dialog";
import { SitesSearch } from "@/components/dashboard/sites/sites-search";
import { SitesStatusFilter } from "@/components/dashboard/sites/sites-status-filter";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

async function restoreWithToast(site: SiteRow) {
  const result = await restoreSite(site.id);

  if (result.ok) {
    toast.success(`${site.name} restored`);
  } else {
    toast.error(result.formError ?? "Could not restore the site");
  }
}

export function SitesDataTable({
  data,
  status,
  sort,
}: {
  data: SitePage;
  status: SiteStatus;
  sort: SortCriterion<SiteSortColumn>[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [formOpen, setFormOpen] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);
  const [editingSite, setEditingSite] = React.useState<SiteRow | null>(null);
  const [deletingSite, setDeletingSite] = React.useState<SiteRow | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [bulkRestoring, setBulkRestoring] = React.useState(false);

  // A new key remounts the dialog, so each open starts from the right defaults.
  const openForm = React.useCallback((site: SiteRow | null) => {
    setEditingSite(site);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }, []);

  // A header click changes the URL, so the server sorts the page. The page goes back to 1.
  const sortBy = React.useCallback(
    (column: SiteSortColumn, shift: boolean) => {
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
      createSiteColumns(
        {
          onEdit: openForm,
          onDelete: setDeletingSite,
          onRestore: restoreWithToast,
        },
        { sort, onSort: sortBy },
      ),
    [openForm, sort, sortBy],
  );

  // Only rows on the current page count, so a stale id is ignored.
  const selectedSites = data.rows.filter((site) => rowSelection[site.id]);
  const selectionMode = bulkSelectionMode(selectedSites);

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
      const result = await restoreSites(selectedSites.map((site) => site.id));
      const names = new Map(selectedSites.map((site) => [site.id, site.name]));
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
          <SitesSearch />
          <SitesStatusFilter status={status} />
        </div>
        <Button onClick={() => openForm(null)}>
          <PlusIcon data-icon="inline-start" />
          Add site
        </Button>
      </div>
      {selectionMode !== "none" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted px-4 py-2">
          <div className="flex flex-col">
            <p className="text-sm font-medium">{selectedSites.length} selected</p>
            {selectionMode === "mixed" && (
              <p className="text-sm text-muted-foreground">
                Select only active sites or only deleted sites.
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
                    ? `No sites match "${query}"`
                    : status === "deleted"
                      ? "No deleted sites"
                      : "No sites yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {data.total} {data.total === 1 ? "site" : "sites"}
        </div>
        <TablePagination
          page={data.page}
          pageCount={pageCount}
          pageSize={data.pageSize}
          onPageChange={(page) => goToPage(page, data.pageSize)}
          onPageSizeChange={(pageSize) => goToPage(1, pageSize)}
        />
      </div>
      <SiteFormDialog
        key={formKey}
        site={editingSite}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
      <BulkDeleteSitesDialog
        sites={selectedSites}
        open={bulkDeleting}
        onOpenChange={setBulkDeleting}
        onComplete={() => setRowSelection({})}
      />
      <DeleteSiteDialog
        site={deletingSite}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingSite(null);
          }
        }}
      />
    </div>
  );
}
