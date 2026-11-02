"use client";

import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import { rejectRequest } from "@/app/dashboard/requests/actions";
import { ACTION_FAILED_MESSAGE } from "@/app/dashboard/requests/request-rules";
import type { RequestActionResult, RequestDialogProps } from "@/types/requests";
import { rejectReasonSchema } from "@/validation/request";
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const REASON_MAX_LENGTH = 500;

export function RejectRequestDialog({
  request,
  onOpenChange,
}: RequestDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { reason: "" },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = rejectReasonSchema.safeParse(value.reason);

        return parsed.success
          ? undefined
          : { fields: { reason: { message: parsed.error.issues[0].message } } };
      },
    },
    onSubmit: async ({ value }) => {
      if (!request) {
        return;
      }

      setFormError(null);

      let result: RequestActionResult;

      try {
        result = await rejectRequest(request.id, value.reason);
      } catch {
        // TanStack Form resets isSubmitting itself, but would rethrow into an unhandled rejection.
        setFormError(ACTION_FAILED_MESSAGE);
        return;
      }

      if (!result.ok) {
        // The dialog stays open, so the reason is kept and HO can fix it or close.
        setFormError(result.formError ?? null);
        return;
      }

      toast.success("Request rejected");
      handleOpenChange(false);
    },
  });

  function handleOpenChange(open: boolean) {
    if (!open) {
      setFormError(null);
      form.reset();
    }

    onOpenChange(open);
  }

  return (
    <Dialog open={request !== null} onOpenChange={handleOpenChange}>
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
            <DialogTitle>Reject request {request?.poNumber}?</DialogTitle>
            <DialogDescription>
              The requester sees this reason on the request.
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
                          maxLength={REASON_MAX_LENGTH}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          autoFocus
                          disabled={isSubmitting}
                          aria-invalid={isInvalid || undefined}
                        />
                        <FieldDescription>
                          {field.state.value.length}/{REASON_MAX_LENGTH}
                        </FieldDescription>
                        {isInvalid && (
                          <FieldError errors={field.state.meta.errors} />
                        )}
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
                  <DialogClose
                    render={<Button variant="outline" disabled={isSubmitting} />}
                  >
                    Cancel
                  </DialogClose>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={isSubmitting}
                  >
                    {isSubmitting && <Spinner data-icon="inline-start" />}
                    Reject
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
