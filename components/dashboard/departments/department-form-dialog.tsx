"use client";

import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import { createDepartment, updateDepartment } from "@/app/dashboard/departments/actions";
import { nameFieldError } from "@/app/dashboard/departments/department-rules";
import type {
  DepartmentFormDialogProps,
  DepartmentLocationChoice,
  DepartmentRow,
} from "@/types/departments";
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
import { departmentNameSchema, departmentSchema } from "@/validation/department";

// A location manager's location is fixed, so the form starts on it. An edit keeps the department's own location.
function defaultLocationId(
  department: DepartmentRow | null,
  locationChoice: DepartmentLocationChoice,
) {
  if (department) {
    return department.locationId;
  }

  return locationChoice.mode === "fixed" ? locationChoice.location.id : "";
}

export function DepartmentFormDialog({
  department,
  locationChoice,
  open,
  onOpenChange,
}: DepartmentFormDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: department?.name ?? "",
      locationId: defaultLocationId(department, locationChoice),
    },
    // The location cannot change after creation, so an edit validates the name alone.
    validators: {
      onSubmit: ({ value }) => {
        const parsed = department
          ? departmentNameSchema.safeParse(value)
          : departmentSchema.safeParse(value);

        if (parsed.success) {
          return undefined;
        }

        const fields: Record<string, { message: string }> = {};

        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0]);
          fields[key] ??= { message: issue.message };
        }

        return { fields };
      },
    },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);

      const result = department
        ? await updateDepartment(department.id, { name: value.name })
        : await createDepartment(value);

      if (!result.ok) {
        setFormError(result.formError ?? null);
        formApi.setErrorMap({
          onSubmit: {
            form: result.formError,
            fields: {
              name: nameFieldError(result.fieldErrors?.name),
              locationId: nameFieldError(result.fieldErrors?.locationId),
            },
          },
        });
        return;
      }

      toast.success(department ? "Department updated" : "Department created");
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
            <DialogTitle>
              {department ? "Edit department" : "Add department"}
            </DialogTitle>
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
                  <form.Field name="locationId">
                    {(field) => {
                      if (department) {
                        return (
                          <Field>
                            <FieldLabel>Location</FieldLabel>
                            <p className="text-sm">{department.locationName}</p>
                          </Field>
                        );
                      }

                      if (locationChoice.mode === "fixed") {
                        return (
                          <Field>
                            <FieldLabel>Location</FieldLabel>
                            <p className="text-sm">{locationChoice.location.name}</p>
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
                              label: `${location.name} (${location.siteName})`,
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
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name} ({location.siteName})
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
