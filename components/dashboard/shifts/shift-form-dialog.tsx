"use client";

import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import { nameFieldError } from "@/app/dashboard/departments/department-rules";
import { createShift, updateShift } from "@/app/dashboard/shifts/actions";
import {
  shiftFieldErrors,
  shiftLocationLabel,
} from "@/app/dashboard/shifts/shift-rules";
import type {
  ShiftFormDialogProps,
  ShiftLocationChoice,
  ShiftRow,
} from "@/types/shifts";
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

// A fixed location starts the form on it. An edit keeps the shift's own location.
function defaultLocationId(
  shift: ShiftRow | null,
  locationChoice: ShiftLocationChoice,
) {
  if (shift) {
    return shift.locationId;
  }

  return locationChoice.mode === "fixed" ? locationChoice.location.id : "";
}

export function ShiftFormDialog({
  shift,
  locationChoice,
  open,
  onOpenChange,
}: ShiftFormDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      // NaN is an empty field, so a new shift starts with a blank order.
      order: shift?.order ?? Number.NaN,
      name: shift?.name ?? "",
      startTime: shift?.startTime ?? "",
      endTime: shift?.endTime ?? "",
      locationId: defaultLocationId(shift, locationChoice),
    },
    // The location cannot change after creation, so an edit validates the other fields alone.
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
            order: value.order,
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
              order: nameFieldError(result.fieldErrors?.order),
              name: nameFieldError(result.fieldErrors?.name),
              startTime: nameFieldError(result.fieldErrors?.startTime),
              endTime: nameFieldError(result.fieldErrors?.endTime),
              locationId: nameFieldError(result.fieldErrors?.locationId),
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
                  <form.Field name="order">
                    {(field) => {
                      const isInvalid = field.state.meta.errors.length > 0;

                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Order</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={9}
                            step={1}
                            value={Number.isNaN(field.state.value) ? "" : field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(
                                event.target.value === ""
                                  ? Number.NaN
                                  : Number(event.target.value),
                              )
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
                  <form.Field name="locationId">
                    {(field) => {
                      if (shift) {
                        return (
                          <Field>
                            <FieldLabel>Location</FieldLabel>
                            <p className="text-sm">
                              {shiftLocationLabel({
                                id: shift.locationId,
                                name: shift.locationName,
                                siteName: shift.siteName,
                              })}
                            </p>
                          </Field>
                        );
                      }

                      if (locationChoice.mode === "fixed") {
                        return (
                          <Field>
                            <FieldLabel>Location</FieldLabel>
                            <p className="text-sm">
                              {shiftLocationLabel(locationChoice.location)}
                            </p>
                          </Field>
                        );
                      }

                      const isInvalid = field.state.meta.errors.length > 0;

                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Location</FieldLabel>
                          <Select
                            value={field.state.value}
                            onValueChange={(value) => {
                              if (value) {
                                field.handleChange(value);
                              }
                            }}
                            items={locationChoice.locations.map((location) => ({
                              value: location.id,
                              label: shiftLocationLabel(location),
                            }))}
                            disabled={isSubmitting}
                          >
                            <SelectTrigger
                              id={field.name}
                              aria-invalid={isInvalid || undefined}
                              className="w-full"
                            >
                              <SelectValue placeholder="Choose a location" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {locationChoice.locations.map((location) => (
                                  <SelectItem
                                    key={location.id}
                                    value={location.id}
                                  >
                                    {shiftLocationLabel(location)}
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
