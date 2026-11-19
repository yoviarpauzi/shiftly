"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteBilling } from "@/app/dashboard/billings/actions";
import { ACTION_FAILED_MESSAGE } from "@/app/dashboard/requests/request-rules";
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
import type { BillingActionResult, DeleteBillingDialogProps } from "@/types/billings";

const BILLINGS_PATH = "/dashboard/billings";

export function DeleteBillingDialog({ billingId, open, onOpenChange }: DeleteBillingDialogProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set once the draft is gone and never reset, so the button stays off until navigation completes.
  const [deleted, setDeleted] = useState(false);

  const busy = isSubmitting || deleted;

  function handleOpenChange(next: boolean) {
    if (busy) {
      return;
    }

    if (!next) {
      setFormError(null);
    }

    onOpenChange(next);
  }

  async function handleConfirm() {
    if (busy) {
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    let result: BillingActionResult;

    try {
      result = await deleteBilling({ billingId });
    } catch {
      setFormError(ACTION_FAILED_MESSAGE);
      return;
    } finally {
      setIsSubmitting(false);
    }

    if (!result.ok) {
      setFormError(result.formError);
      return;
    }

    setDeleted(true);
    toast.success("Draft deleted");
    router.push(BILLINGS_PATH);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
          <AlertDialogDescription>
            The draft is removed. No days are held by it, so nothing else changes.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={handleConfirm}>
            {busy && <Spinner data-icon="inline-start" />}
            Delete draft
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
