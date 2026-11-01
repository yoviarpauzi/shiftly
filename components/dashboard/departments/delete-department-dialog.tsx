"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteDepartment } from "@/app/dashboard/departments/actions";
import type { DeleteDepartmentDialogProps } from "@/types/departments";
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

export function DeleteDepartmentDialog({
  department,
  onOpenChange,
}: DeleteDepartmentDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setFormError(null);
    }

    onOpenChange(open);
  }

  async function handleDelete() {
    if (!department) {
      return;
    }

    setFormError(null);
    setIsDeleting(true);

    const result = await deleteDepartment(department.id);

    setIsDeleting(false);

    if (!result.ok) {
      setFormError(result.formError ?? null);
      return;
    }

    toast.success("Department deleted");
    handleOpenChange(false);
  }

  return (
    <AlertDialog open={department !== null} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {department?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The department moves to Deleted. You can restore it from that filter.
            A department with active sub-departments cannot be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
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
