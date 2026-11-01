"use client";

import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import { createSite, updateSite } from "@/app/dashboard/sites/actions";
import type { SiteFormDialogProps } from "@/types/sites";
import { nameFieldError } from "@/app/dashboard/sites/site-rules";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { siteSchema } from "@/validation/site";

export function SiteFormDialog({
  site,
  open,
  onOpenChange,
}: SiteFormDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: site?.name ?? "" },
    validators: { onSubmit: siteSchema },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);

      const result = site
        ? await updateSite(site.id, value)
        : await createSite(value);

      if (!result.ok) {
        setFormError(result.formError ?? null);
        formApi.setErrorMap({
          onSubmit: {
            form: result.formError,
            fields: { name: nameFieldError(result.fieldErrors?.name) },
          },
        });
        return;
      }

      toast.success(site ? "Site updated" : "Site created");
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <DialogTitle>{site ? "Edit site" : "Add site"}</DialogTitle>
          </DialogHeader>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <>
                <FieldGroup>
                  <form.Field name="name">
                    {(field) => {
                      const isInvalid = field.state.meta.errors.length > 0;

                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            autoFocus
                            disabled={isSubmitting}
                            aria-invalid={isInvalid || undefined}
                          />
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>
                </FieldGroup>
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
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Spinner data-icon="inline-start" />}
                    Save
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
