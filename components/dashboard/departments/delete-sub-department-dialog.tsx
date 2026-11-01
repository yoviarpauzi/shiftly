"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteSubDepartment } from "@/app/dashboard/departments/sub-department-actions";
import type { DeleteSubDepartmentDialogProps } from "@/types/departments";
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

export function DeleteSubDepartmentDialog({
  subDepartment,
  onOpenChange,
}: DeleteSubDepartmentDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setFormError(null);
    }

    onOpenChange(open);
  }

  async function handleDelete() {
    if (!subDepartment) {
      return;
    }

    setFormError(null);
    setIsDeleting(true);

    const result = await deleteSubDepartment(subDepartment.id);

    setIsDeleting(false);

    if (!result.ok) {
      setFormError(result.formError ?? null);
      return;
    }

    toast.success("Sub-department deleted");
    handleOpenChange(false);
  }

  return (
    <AlertDialog open={subDepartment !== null} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {subDepartment?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The sub-department moves to Deleted. You can restore it from the actions menu.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={isDeleting} onClick={handleDelete}>
            {isDeleting && <Spinner data-icon="inline-start" />}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
