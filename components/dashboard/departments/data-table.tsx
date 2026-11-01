"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type RowSelectionState, useTable } from "@tanstack/react-table";
import { PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  restoreDepartment,
  restoreDepartments,
} from "@/app/dashboard/departments/actions";
import {
  bulkRestoreMessage,
  bulkSelectionMode,
} from "@/app/dashboard/departments/department-rules";
import { nextSort } from "@/lib/sort";
import { serializeSort } from "@/validation/sort";
import type { SortCriterion } from "@/types/sort";
import type {
  DepartmentLocationChoice,
  DepartmentPage,
  DepartmentRow,
  DepartmentSortColumn,
  DepartmentStatus,
} from "@/types/departments";
import { TablePagination } from "@/components/dashboard/pagination";
import { BulkDeleteDepartmentsDialog } from "@/components/dashboard/departments/bulk-delete-departments-dialog";
import {
  createDepartmentColumns,
  features,
} from "@/components/dashboard/departments/columns";
import { DeleteDepartmentDialog } from "@/components/dashboard/departments/delete-department-dialog";
import { DepartmentFormDialog } from "@/components/dashboard/departments/department-form-dialog";
import { DepartmentsLocationFilter } from "@/components/dashboard/departments/departments-location-filter";
import { DepartmentsSearch } from "@/components/dashboard/departments/departments-search";
import { DepartmentsStatusFilter } from "@/components/dashboard/departments/departments-status-filter";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

async function restoreWithToast(department: DepartmentRow) {
  const result = await restoreDepartment(department.id);

  if (result.ok) {
    toast.success(`${department.name} restored`);
  } else {
    toast.error(result.formError ?? "Could not restore the department");
  }
}

export function DepartmentsDataTable({
  data,
  status,
  locationId,
  locationChoice,
  sort,
}: {
  data: DepartmentPage;
  status: DepartmentStatus;
  locationId: string | null;
  locationChoice: DepartmentLocationChoice;
  sort: SortCriterion<DepartmentSortColumn>[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [formOpen, setFormOpen] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);
  const [editingDepartment, setEditingDepartment] = React.useState<DepartmentRow | null>(null);
  const [deletingDepartment, setDeletingDepartment] = React.useState<DepartmentRow | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [bulkRestoring, setBulkRestoring] = React.useState(false);

  // A new key remounts the dialog, so each open starts from the right defaults.
  const openForm = React.useCallback((department: DepartmentRow | null) => {
    setEditingDepartment(department);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }, []);

  // A header click changes the URL, so the server sorts the page. The page goes back to 1.
  const sortBy = React.useCallback(
    (column: DepartmentSortColumn, shift: boolean) => {
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
      createDepartmentColumns(
        {
          onEdit: openForm,
          onDelete: setDeletingDepartment,
          onRestore: restoreWithToast,
        },
        { sort, onSort: sortBy },
      ),
    [openForm, sort, sortBy],
  );

  // Only rows on the current page count, so a stale id is ignored.
  const selectedDepartments = data.rows.filter((department) => rowSelection[department.id]);
  const selectionMode = bulkSelectionMode(selectedDepartments);

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
      const result = await restoreDepartments(selectedDepartments.map((department) => department.id));
      const names = new Map(selectedDepartments.map((department) => [department.id, department.name]));
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
          <DepartmentsSearch total={data.total} />
          <DepartmentsStatusFilter status={status} />
          {locationChoice.mode === "pick" && (
            <DepartmentsLocationFilter
              locationId={locationId}
              locations={locationChoice.locations}
            />
          )}
        </div>
        <Button onClick={() => openForm(null)}>
          <PlusIcon data-icon="inline-start" />
          Add department
        </Button>
      </div>
      {selectionMode !== "none" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted px-4 py-2">
          <div className="flex flex-col">
            <p className="text-sm font-medium">{selectedDepartments.length} selected</p>
            {selectionMode === "mixed" && (
              <p className="text-sm text-muted-foreground">
                Select only active departments or only deleted departments.
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
                    ? `No departments match "${query}"`
                    : status === "deleted"
                      ? "No deleted departments"
                      : "No departments yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {data.total} {data.total === 1 ? "department" : "departments"}
        </div>
        <TablePagination
          page={data.page}
          pageSize={data.pageSize}
          pageCount={pageCount}
          onPageChange={(page) => goToPage(page, data.pageSize)}
          onPageSizeChange={(pageSize) => goToPage(1, pageSize)}
        />
      </div>
      <DepartmentFormDialog
        key={formKey}
        department={editingDepartment}
        locationChoice={locationChoice}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
      <BulkDeleteDepartmentsDialog
        departments={selectedDepartments}
        open={bulkDeleting}
        onOpenChange={setBulkDeleting}
        onComplete={() => setRowSelection({})}
      />
      <DeleteDepartmentDialog
        department={deletingDepartment}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingDepartment(null);
          }
        }}
      />
    </div>
  );
}
