"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteLocations } from "@/app/dashboard/locations/actions";
import { bulkDeleteMessage } from "@/app/dashboard/locations/location-rules";
import type { BulkDeleteLocationsDialogProps } from "@/types/locations";
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

export function BulkDeleteLocationsDialog({
  locations,
  open,
  onOpenChange,
  onComplete,
}: BulkDeleteLocationsDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const result = await deleteLocations(locations.map((location) => location.id));
      const names = new Map(locations.map((location) => [location.id, location.name]));
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

  const count = locations.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} {count === 1 ? "location" : "locations"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The selected locations move to Deleted and can be restored from that
            filter. A location with assigned admin site users or active
            departments is kept, and the reason is shown.
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
