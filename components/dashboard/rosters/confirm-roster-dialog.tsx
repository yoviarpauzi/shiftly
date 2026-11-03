"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ACTION_FAILED_MESSAGE } from "@/app/dashboard/requests/request-rules";
import { confirmRoster } from "@/app/dashboard/rosters/actions";
import { confirmDescription } from "@/app/dashboard/rosters/roster-rules";
import type { ConfirmRosterDialogProps } from "@/types/rosters";
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

export function ConfirmRosterDialog({ roster, open, onOpenChange }: ConfirmRosterDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setFormError(null);
    }

    onOpenChange(next);
  }

  async function handleConfirm() {
    setFormError(null);
    setIsSubmitting(true);

    try {
      const result = await confirmRoster({ rosterId: roster.id, version: roster.version });

      if (!result.ok) {
        setFormError(result.formError);
        return;
      }

      toast.success("Roster confirmed");
      handleOpenChange(false);
    } catch {
      setFormError(ACTION_FAILED_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm this roster?</AlertDialogTitle>
          <AlertDialogDescription>{confirmDescription(roster.unfilled)}</AlertDialogDescription>
        </AlertDialogHeader>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <Button disabled={isSubmitting} onClick={handleConfirm}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            Confirm roster
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
