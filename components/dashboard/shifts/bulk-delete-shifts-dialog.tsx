"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteShifts } from "@/app/dashboard/shifts/actions";
import { bulkShiftDeleteMessage } from "@/app/dashboard/shifts/shift-rules";
import type { BulkDeleteShiftsDialogProps } from "@/types/shifts";
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

export function BulkDeleteShiftsDialog({
  shifts,
  open,
  onOpenChange,
  onComplete,
}: BulkDeleteShiftsDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const result = await deleteShifts(shifts.map((shift) => shift.id));
      const names = new Map(shifts.map((shift) => [shift.id, shift.name]));
      const message = bulkShiftDeleteMessage(
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

  const count = shifts.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} {count === 1 ? "shift" : "shifts"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The selected shifts move to Deleted and can be restored from that
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
