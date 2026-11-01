"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteDepartments } from "@/app/dashboard/departments/actions";
import { bulkDeleteMessage } from "@/app/dashboard/departments/department-rules";
import type { BulkDeleteDepartmentsDialogProps } from "@/types/departments";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function BulkDeleteDepartmentsDialog({
  departments,
  open,
  onOpenChange,
  onComplete,
}: BulkDeleteDepartmentsDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const result = await deleteDepartments(departments.map((department) => department.id));
      const names = new Map(departments.map((department) => [department.id, department.name]));
      const message = bulkDeleteMessage(
        result.deletedIds.length,
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

      onOpenChange(false);
      onComplete();
    } finally {
      setIsDeleting(false);
    }
  }

  const count = departments.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} {count === 1 ? "department" : "departments"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The selected departments move to Deleted and can be restored from that
            filter. A department with active sub-departments is kept, and the
            reason is shown.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            {isDeleting && <Spinner data-icon="inline-start" />}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
