"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteLocation } from "@/app/dashboard/locations/actions";
import type { DeleteLocationDialogProps } from "@/types/locations";
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

export function DeleteLocationDialog({
  location,
  onOpenChange,
}: DeleteLocationDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setFormError(null);
    }

    onOpenChange(open);
  }

  async function handleDelete() {
    if (!location) {
      return;
    }

    setFormError(null);
    setIsDeleting(true);

    const result = await deleteLocation(location.id);

    setIsDeleting(false);

    if (!result.ok) {
      setFormError(result.formError ?? null);
      return;
    }

    toast.success("Location deleted");
    handleOpenChange(false);
  }

  return (
    <AlertDialog open={location !== null} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {location?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The location moves to Deleted. You can restore it from that filter.
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
