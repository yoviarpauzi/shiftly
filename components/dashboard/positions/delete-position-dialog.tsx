"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deletePosition } from "@/app/dashboard/positions/actions";
import type { DeletePositionDialogProps } from "@/types/positions";
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

export function DeletePositionDialog({
  position,
  onOpenChange,
}: DeletePositionDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setFormError(null);
    }

    onOpenChange(open);
  }

  async function handleDelete() {
    if (!position) {
      return;
    }

    setFormError(null);
    setIsDeleting(true);

    const result = await deletePosition(position.id);

    setIsDeleting(false);

    if (!result.ok) {
      setFormError(result.formError ?? null);
      return;
    }

    toast.success("Position deleted");
    handleOpenChange(false);
  }

  return (
    <AlertDialog open={position !== null} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {position?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The position moves to Deleted. You can restore it from that filter.
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
