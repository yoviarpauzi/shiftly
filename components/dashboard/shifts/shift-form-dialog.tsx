"use client";

import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import { nameFieldError } from "@/app/dashboard/departments/department-rules";
import { createShift, updateShift } from "@/app/dashboard/shifts/actions";
import { shiftFieldErrors } from "@/app/dashboard/shifts/shift-rules";
import type { SiteChoice } from "@/types/locations";
import type { ShiftFormDialogProps, ShiftRow } from "@/types/shifts";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { shiftSchema, shiftUpdateSchema } from "@/validation/shift";

const NUMBER_OPTIONS = Array.from({ length: 9 }, (_, index) => ({
  value: `${index + 1}`,
  label: `${index + 1}`,
}));

// A fixed site starts the form on it. An edit keeps the shift's own site.
function defaultSiteId(shift: ShiftRow | null, siteChoice: SiteChoice) {
  if (shift) {
    return shift.siteId;
  }

  return siteChoice.mode === "fixed" ? siteChoice.site.id : "";
}

export function ShiftFormDialog({
  shift,
  siteChoice,
  open,
  onOpenChange,
}: ShiftFormDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      number: shift?.number ?? 1,
      name: shift?.name ?? "",
      startTime: shift?.startTime ?? "",
      endTime: shift?.endTime ?? "",
      siteId: defaultSiteId(shift, siteChoice),
    },
    // The site cannot change after creation, so an edit validates the other fields alone.
    validators: {
      onSubmit: ({ value }) => {
        const parsed = shift
          ? shiftUpdateSchema.safeParse(value)
          : shiftSchema.safeParse(value);

        if (parsed.success) {
          return undefined;
        }

        const fields: Record<string, { message: string }> = {};

        for (const [field, message] of Object.entries(
          shiftFieldErrors(parsed.error.issues),
        )) {
          fields[field] = { message };
        }

        return { fields };
      },
    },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);

      const result = shift
        ? await updateShift(shift.id, {
            number: value.number,
            name: value.name,
            startTime: value.startTime,
            endTime: value.endTime,
          })
        : await createShift(value);

      if (!result.ok) {
        setFormError(result.formError ?? null);
        formApi.setErrorMap({
          onSubmit: {
            form: result.formError,
            fields: {
              number: nameFieldError(result.fieldErrors?.number),
              name: nameFieldError(result.fieldErrors?.name),
              startTime: nameFieldError(result.fieldErrors?.startTime),
              endTime: nameFieldError(result.fieldErrors?.endTime),
              siteId: nameFieldError(result.fieldErrors?.siteId),
            },
          },
        });
        return;
      }

      toast.success(shift ? "Shift updated" : "Shift created");
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
            <DialogTitle>{shift ? "Edit shift" : "Add shift"}</DialogTitle>
          </DialogHeader>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <>
                <FieldGroup>
                  <form.Field name="number">
                    {(field) => {
                      const isInvalid = field.state.meta.errors.length > 0;

                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Number</FieldLabel>
                          <Select
                            value={`${field.state.value}`}
                            onValueChange={(value) => {
                              if (value) {
                                field.handleChange(Number(value));
                              }
                            }}
                            items={NUMBER_OPTIONS}
                            disabled={isSubmitting}
                          >
                            <SelectTrigger
                              id={field.name}
                              aria-invalid={isInvalid || undefined}
                              className="w-full"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {NUMBER_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                          )}
                        </Field>
                      );
                    }}
                  </form.Field>
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
                  <div className="grid grid-cols-2 gap-4">
                    <form.Field name="startTime">
                      {(field) => {
                        const isInvalid = field.state.meta.errors.length > 0;

                        return (
                          <Field data-invalid={isInvalid || undefined}>
                            <FieldLabel htmlFor={field.name}>Start time</FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              type="time"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
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
                    <form.Field name="endTime">
                      {(field) => {
                        const isInvalid = field.state.meta.errors.length > 0;

                        return (
                          <Field data-invalid={isInvalid || undefined}>
                            <FieldLabel htmlFor={field.name}>End time</FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              type="time"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
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
                  </div>
                  <form.Field name="siteId">
                    {(field) => {
                      if (shift) {
                        return (
                          <Field>
                            <FieldLabel>Site</FieldLabel>
                            <p className="text-sm">{shift.siteName}</p>
                          </Field>
                        );
                      }

                      if (siteChoice.mode === "fixed") {
                        return (
                          <Field>
                            <FieldLabel>Site</FieldLabel>
                            <p className="text-sm">{siteChoice.site.name}</p>
                          </Field>
                        );
                      }

                      const isInvalid = field.state.meta.errors.length > 0;

                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Site</FieldLabel>
                          <Select
                            value={field.state.value}
                            onValueChange={(value) => {
                              if (value) {
                                field.handleChange(value);
                              }
                            }}
                            items={siteChoice.sites.map((site) => ({
                              value: site.id,
                              label: site.name,
                            }))}
                            disabled={isSubmitting}
                          >
                            <SelectTrigger
                              id={field.name}
                              aria-invalid={isInvalid || undefined}
                              className="w-full"
                            >
                              <SelectValue placeholder="Choose a site" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {siteChoice.sites.map((site) => (
                                  <SelectItem key={site.id} value={site.id}>
                                    {site.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
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
