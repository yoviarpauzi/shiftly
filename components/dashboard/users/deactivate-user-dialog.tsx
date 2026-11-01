"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deactivateUser, reactivateUser } from "@/app/dashboard/users/actions";
import type { DeactivateUserDialogProps } from "@/types/users";
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

export function DeactivateUserDialog({
  user,
  onOpenChange,
}: DeactivateUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isReactivating = user?.banned === true;
  const actionLabel = isReactivating ? "Reactivate" : "Deactivate";

  async function handleConfirm() {
    if (!user) {
      return;
    }

    setIsSubmitting(true);

    const result = isReactivating
      ? await reactivateUser(user.id)
      : await deactivateUser(user.id);

    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.formError ?? "Something went wrong");
      return;
    }

    toast.success(isReactivating ? "User reactivated" : "User deactivated");
    onOpenChange(false);
  }

  return (
    <AlertDialog open={user !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {actionLabel} {user?.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isReactivating
              ? "The user can sign in again."
              : "The user cannot sign in until you reactivate them, and their open sessions end."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <Button
            variant={isReactivating ? "default" : "destructive"}
            disabled={isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting && <Spinner data-icon="inline-start" />}
            {actionLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
