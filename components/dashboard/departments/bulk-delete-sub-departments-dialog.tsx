"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteSubDepartments } from "@/app/dashboard/departments/sub-department-actions";
import { bulkSubDepartmentDeleteMessage } from "@/app/dashboard/departments/department-rules";
import type { BulkDeleteSubDepartmentsDialogProps } from "@/types/departments";
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

export function BulkDeleteSubDepartmentsDialog({
  subDepartments,
  open,
  onOpenChange,
  onComplete,
}: BulkDeleteSubDepartmentsDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const result = await deleteSubDepartments(subDepartments.map((subDepartment) => subDepartment.id));
      const names = new Map(subDepartments.map((subDepartment) => [subDepartment.id, subDepartment.name]));
      const message = bulkSubDepartmentDeleteMessage(
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

  const count = subDepartments.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} {count === 1 ? "sub-department" : "sub-departments"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The selected sub-departments move to Deleted and can be restored from
            that filter.
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
