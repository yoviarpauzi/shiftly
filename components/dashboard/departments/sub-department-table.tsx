"use client";

import * as React from "react";
import { useTable } from "@tanstack/react-table";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { restoreSubDepartment } from "@/app/dashboard/departments/sub-department-actions";
import type { SubDepartmentRow, SubDepartmentTableProps } from "@/types/departments";
import { DeleteSubDepartmentDialog } from "@/components/dashboard/departments/delete-sub-department-dialog";
import {
  createSubDepartmentColumns,
  subDepartmentFeatures,
} from "@/components/dashboard/departments/sub-department-columns";
import { SubDepartmentFormDialog } from "@/components/dashboard/departments/sub-department-form-dialog";
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

export function SubDepartmentTable({ departmentId, rows }: SubDepartmentTableProps) {
  const [formOpen, setFormOpen] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);
  const [editingSubDepartment, setEditingSubDepartment] =
    React.useState<SubDepartmentRow | null>(null);
  const [deletingSubDepartment, setDeletingSubDepartment] =
    React.useState<SubDepartmentRow | null>(null);

  // A new key remounts the dialog, so each open starts from the right defaults.
  const openForm = React.useCallback((subDepartment: SubDepartmentRow | null) => {
    setEditingSubDepartment(subDepartment);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }, []);

  const columns = React.useMemo(
    () =>
      createSubDepartmentColumns({
        onEdit: openForm,
        onDelete: setDeletingSubDepartment,
        onRestore: restoreWithToast,
      }),
    [openForm],
  );

  const table = useTable({
    features: subDepartmentFeatures,
    data: rows,
    columns,
    getRowId: (row) => row.id,
  });

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Sub-departments</h2>
        <Button onClick={() => openForm(null)}>
          <PlusIcon data-icon="inline-start" />
          Add sub-department
        </Button>
      </div>
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
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No sub-departments yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <SubDepartmentFormDialog
        key={formKey}
        departmentId={departmentId}
        subDepartment={editingSubDepartment}
        open={formOpen}
        onOpenChange={setFormOpen}
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
