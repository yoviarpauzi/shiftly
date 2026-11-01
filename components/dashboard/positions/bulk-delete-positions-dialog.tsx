"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deletePositions } from "@/app/dashboard/positions/actions";
import { bulkPositionDeleteMessage } from "@/app/dashboard/positions/position-rules";
import type { BulkDeletePositionsDialogProps } from "@/types/positions";
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

export function BulkDeletePositionsDialog({
  positions,
  open,
  onOpenChange,
  onComplete,
}: BulkDeletePositionsDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const result = await deletePositions(positions.map((position) => position.id));
      const names = new Map(positions.map((position) => [position.id, position.name]));
      const message = bulkPositionDeleteMessage(
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

  const count = positions.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} {count === 1 ? "position" : "positions"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The selected positions move to Deleted and can be restored from that
            filter.
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
