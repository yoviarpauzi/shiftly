"use client";

import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { voidBilling } from "@/app/dashboard/billings/actions";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { BillingActionResult, VoidBillingDialogProps } from "@/types/billings";
import { VOID_REASON_MAX_LENGTH, voidBillingSchema } from "@/validation/billings";

export function VoidBillingDialog({
  billingId,
  version,
  number,
  open,
  onOpenChange,
}: VoidBillingDialogProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { reason: "" },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = voidBillingSchema.safeParse({ billingId, version, reason: value.reason });

        if (parsed.success) {
          return undefined;
        }

        // The id and version come from the page. Only a reason problem is the user's to fix here.
        const issue = parsed.error.issues.find((item) => item.path[0] === "reason");

        return issue ? { fields: { reason: { message: issue.message } } } : undefined;
      },
    },
    onSubmit: async ({ value }) => {
      setFormError(null);

      let result: BillingActionResult;

      try {
        result = await voidBilling({ billingId, version, reason: value.reason });
      } catch {
        // TanStack Form resets isSubmitting itself, but would rethrow into an unhandled rejection.
        setFormError(ACTION_FAILED_MESSAGE);
        return;
      }

      if (!result.ok) {
        // The dialog stays open, so the reason is kept.
        setFormError(result.formError);
        return;
      }

      toast.success("Billing voided");
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
            <DialogTitle>Void billing {number}?</DialogTitle>
            <DialogDescription>
              The days it holds are freed, so they can be billed again and changed in Attendance. A
              voided billing cannot be issued again.
            </DialogDescription>
          </DialogHeader>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <>
                <form.Field name="reason">
                  {(field) => {
                    const isInvalid = field.state.meta.errors.length > 0;

                    return (
                      <Field data-invalid={isInvalid || undefined}>
                        <FieldLabel htmlFor={field.name}>Reason</FieldLabel>
                        <Textarea
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          maxLength={VOID_REASON_MAX_LENGTH}
                          onBlur={field.handleBlur}
                          placeholder="Explain why the billing is voided"
                          onChange={(event) => field.handleChange(event.target.value)}
                          autoFocus
                          disabled={isSubmitting}
                          aria-invalid={isInvalid || undefined}
                        />
                        <FieldDescription>
                          {field.state.value.length}/{VOID_REASON_MAX_LENGTH}
                        </FieldDescription>
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </Field>
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
                  <Button type="submit" variant="destructive" disabled={isSubmitting}>
                    {isSubmitting && <Spinner data-icon="inline-start" />}
                    Void billing
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
