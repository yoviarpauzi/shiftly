"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cancelRequest } from "@/app/dashboard/requests/actions";
import { ACTION_FAILED_MESSAGE } from "@/app/dashboard/requests/request-rules";
import type { RequestActionResult, RequestDialogProps } from "@/types/requests";
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

export function CancelRequestDialog({
  request,
  onOpenChange,
}: RequestDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setFormError(null);
    }

    onOpenChange(open);
  }

  async function handleConfirm() {
    if (!request) {
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    let result: RequestActionResult;

    try {
      result = await cancelRequest(request.id);
    } catch {
      setFormError(ACTION_FAILED_MESSAGE);
      return;
    } finally {
      setIsSubmitting(false);
    }

    if (!result.ok) {
      setFormError(result.formError ?? null);
      return;
    }

    toast.success("Request cancelled");
    handleOpenChange(false);
  }

  return (
    <AlertDialog open={request !== null} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel request {request?.poNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            The request becomes Cancelled and can no longer be edited or approved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Keep request</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting && <Spinner data-icon="inline-start" />}
            Cancel request
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
