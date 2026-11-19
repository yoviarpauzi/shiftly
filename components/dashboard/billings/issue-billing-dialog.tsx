"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { issueBilling } from "@/app/dashboard/billings/actions";
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
import type { BillingActionResult, IssueBillingDialogProps } from "@/types/billings";

export function IssueBillingDialog({
  billingId,
  version,
  locationName,
  periodLabel,
  groups,
  open,
  onOpenChange,
}: IssueBillingDialogProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    if (isSubmitting) {
      return;
    }

    if (!next) {
      setFormError(null);
    }

    onOpenChange(next);
  }

  async function handleConfirm() {
    if (isSubmitting) {
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    let result: BillingActionResult;

    try {
      result = await issueBilling({ billingId, version });
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

    toast.success("Billing issued");
    // Not handleOpenChange: its isSubmitting is still true in this closure.
    onOpenChange(false);
    router.refresh();
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Issue this billing?</AlertDialogTitle>
          <AlertDialogDescription>
            {locationName}, {periodLabel}. It gets a number and holds these days, so no other
            billing can bill them. The days are counted again when you confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex max-h-60 flex-col gap-2 overflow-y-auto rounded-lg border p-3 text-sm">
          <ul className="flex flex-col gap-1">
            {groups.pos.map((group) => (
              <li key={group.requestId} className="flex justify-between gap-4">
                <span className="break-all">{group.poNumber}</span>
                <span className="tabular-nums">
                  {group.subtotal} {group.subtotal === 1 ? "day" : "days"}
                </span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between gap-4 border-t pt-2 font-medium">
            <span>Total</span>
            <span className="tabular-nums">
              {groups.totalDays} {groups.totalDays === 1 ? "day" : "days"}
            </span>
          </p>
        </div>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <Button disabled={isSubmitting || groups.totalDays === 0} onClick={handleConfirm}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            Issue billing
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
