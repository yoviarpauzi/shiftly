"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { updateBillingPeriod } from "@/app/dashboard/billings/actions";
import { ACTION_FAILED_MESSAGE } from "@/app/dashboard/requests/request-rules";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError, FieldLegend, FieldSet } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import type { BillingActionResult, EditPeriodDialogProps } from "@/types/billings";
import { updateBillingPeriodSchema } from "@/validation/billings";
import { BillingPeriodFields } from "./billing-period-fields";

export function EditPeriodDialog({
  billingId,
  version,
  initialPeriod,
  open,
  onOpenChange,
}: EditPeriodDialogProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { period: initialPeriod },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = updateBillingPeriodSchema.safeParse({
          billingId,
          version,
          period: value.period,
        });

        if (parsed.success) {
          return undefined;
        }

        // The id and version come from the page. Only a period problem is the user's to fix here.
        const issue = parsed.error.issues.find((item) => item.path[0] === "period");

        return issue ? { fields: { period: { message: issue.message } } } : undefined;
      },
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      let result: BillingActionResult;

      try {
        result = await updateBillingPeriod({ billingId, version, period: value.period });
      } catch {
        setFormError(ACTION_FAILED_MESSAGE);
        return;
      }

      if (!result.ok) {
        setFormError(result.formError);
        return;
      }

      toast.success("Period updated");
      handleOpenChange(false);
      router.refresh();
    },
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      setFormError(null);
      form.reset();
    }

    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit period</DialogTitle>
            <DialogDescription>
              The days to bill are counted again for the new period.
            </DialogDescription>
          </DialogHeader>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <>
                <form.Field name="period">
                  {(field) => {
                    const isInvalid = field.state.meta.errors.length > 0;

                    return (
                      <FieldSet data-invalid={isInvalid || undefined}>
                        <FieldLegend variant="label">Period</FieldLegend>
                        <BillingPeriodFields
                          value={field.state.value}
                          onChange={field.handleChange}
                          disabled={isSubmitting}
                        />
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </FieldSet>
                    );
                  }}
                </form.Field>
                {formError && (
                  <p role="alert" className="text-sm text-destructive">
                    {formError}
                  </p>
                )}
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" disabled={isSubmitting} />}>
                    Cancel
                  </DialogClose>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Spinner data-icon="inline-start" />}
                    Save period
                  </Button>
                </DialogFooter>
              </>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
