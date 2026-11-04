"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ACTION_FAILED_MESSAGE } from "@/app/dashboard/requests/request-rules";
import { generateRoster } from "@/app/dashboard/rosters/actions";
import { generateAgainDescription } from "@/app/dashboard/rosters/roster-rules";
import type { GenerateAgainDialogProps } from "@/types/rosters";
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

// Repeats the split the draft was generated with. To change the split, the Generate screen has it.
export function GenerateAgainDialog({
  roster,
  generateInput,
  open,
  onOpenChange,
}: GenerateAgainDialogProps) {
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
      const result = await generateRoster({ ...generateInput, version: roster.version });

      if (!result.ok) {
        setFormError(result.formError);
        return;
      }

      toast.success("Roster generated again");
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
          <AlertDialogTitle>Generate this roster again?</AlertDialogTitle>
          <AlertDialogDescription>
            {generateAgainDescription(roster.edits, roster.conflicts)}
          </AlertDialogDescription>
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
            Generate again
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
