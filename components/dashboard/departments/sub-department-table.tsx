"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type RowSelectionState, useTable } from "@tanstack/react-table";
import { PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  bulkSelectionMode,
  bulkSubDepartmentRestoreMessage,
} from "@/app/dashboard/departments/department-rules";
import {
  restoreSubDepartment,
  restoreSubDepartments,
} from "@/app/dashboard/departments/sub-department-actions";
import { nextSort } from "@/lib/sort";
import { serializeSort } from "@/validation/sort";
import type {
  SubDepartmentRow,
  SubDepartmentSortColumn,
  SubDepartmentTableProps,
} from "@/types/departments";
import { TablePagination } from "@/components/dashboard/pagination";
import { BulkDeleteSubDepartmentsDialog } from "@/components/dashboard/departments/bulk-delete-sub-departments-dialog";
import { DeleteSubDepartmentDialog } from "@/components/dashboard/departments/delete-sub-department-dialog";
import {
  createSubDepartmentColumns,
  subDepartmentFeatures,
} from "@/components/dashboard/departments/sub-department-columns";
import { SubDepartmentFormDialog } from "@/components/dashboard/departments/sub-department-form-dialog";
import { SubDepartmentsSearch } from "@/components/dashboard/departments/sub-departments-search";
import { SubDepartmentsStatusFilter } from "@/components/dashboard/departments/sub-departments-status-filter";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

async function restoreWithToast(subDepartment: SubDepartmentRow) {
  const result = await restoreSubDepartment(subDepartment.id);

  if (result.ok) {
    toast.success(`${subDepartment.name} restored`);
  } else {
    toast.error(result.formError ?? "Could not restore the sub-department");
  }
}

export function SubDepartmentTable({ departmentId, data, status, sort }: SubDepartmentTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [formOpen, setFormOpen] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);
  const [editingSubDepartment, setEditingSubDepartment] =
    React.useState<SubDepartmentRow | null>(null);
  const [deletingSubDepartment, setDeletingSubDepartment] =
    React.useState<SubDepartmentRow | null>(null);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const [bulkRestoring, setBulkRestoring] = React.useState(false);

  // A new key remounts the dialog, so each open starts from the right defaults.
  const openForm = React.useCallback((subDepartment: SubDepartmentRow | null) => {
    setEditingSubDepartment(subDepartment);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }, []);

  // A header click changes the URL, so the server sorts the page. The page goes back to 1.
  const sortBy = React.useCallback(
    (column: SubDepartmentSortColumn, shift: boolean) => {
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
      createSubDepartmentColumns(
        {
          onEdit: openForm,
          onDelete: setDeletingSubDepartment,
          onRestore: restoreWithToast,
        },
        { sort, onSort: sortBy },
      ),
    [openForm, sort, sortBy],
  );

  // Only rows on the current page count, so a stale id is ignored.
  const selectedSubDepartments = data.rows.filter((row) => rowSelection[row.id]);
  const selectionMode = bulkSelectionMode(selectedSubDepartments);

  const table = useTable({
    features: subDepartmentFeatures,
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
      const result = await restoreSubDepartments(
        selectedSubDepartments.map((subDepartment) => subDepartment.id),
      );
      const names = new Map(
        selectedSubDepartments.map((subDepartment) => [subDepartment.id, subDepartment.name]),
      );
      const message = bulkSubDepartmentRestoreMessage(
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
        <h2 className="text-lg font-medium">Sub-departments</h2>
        <Button onClick={() => openForm(null)}>
          <PlusIcon data-icon="inline-start" />
          Add sub-department
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <SubDepartmentsSearch />
        <SubDepartmentsStatusFilter status={status} />
      </div>
      {selectionMode !== "none" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted px-4 py-2">
          <div className="flex flex-col">
            <p className="text-sm font-medium">{selectedSubDepartments.length} selected</p>
            {selectionMode === "mixed" && (
              <p className="text-sm text-muted-foreground">
                Select only active sub-departments or only deleted sub-departments.
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
                    ? `No sub-departments match "${query}"`
                    : status === "deleted"
                      ? "No deleted sub-departments"
                      : "No sub-departments yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {data.total} {data.total === 1 ? "sub-department" : "sub-departments"}
        </div>
        <TablePagination
          page={data.page}
          pageSize={data.pageSize}
          pageCount={pageCount}
          onPageChange={(page) => goToPage(page, data.pageSize)}
          onPageSizeChange={(pageSize) => goToPage(1, pageSize)}
        />
      </div>
      <SubDepartmentFormDialog
        key={formKey}
        departmentId={departmentId}
        subDepartment={editingSubDepartment}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
      <BulkDeleteSubDepartmentsDialog
        subDepartments={selectedSubDepartments}
        open={bulkDeleting}
        onOpenChange={setBulkDeleting}
        onComplete={() => setRowSelection({})}
      />
      <DeleteSubDepartmentDialog
        subDepartment={deletingSubDepartment}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingSubDepartment(null);
          }
        }}
      />
    </div>
  );
}
