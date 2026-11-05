"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import { createDepartment, updateDepartment } from "@/app/dashboard/departments/actions";
import {
  departmentLocationAfterSiteChange,
  departmentLocationsFor,
  departmentSiteDefault,
  departmentSitesFrom,
  nameFieldError,
} from "@/app/dashboard/departments/department-rules";
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

// A location manager's location is fixed, so the form starts on it. An edit keeps the department's own
// location. Otherwise the form starts on the location of the starting site, if that site has just one.
function defaultLocationId(
  department: DepartmentRow | null,
  locationChoice: DepartmentLocationChoice,
  siteId: string,
) {
  if (department) {
    return department.locationId;
  }

  return locationChoice.mode === "fixed"
    ? locationChoice.location.id
    : departmentLocationAfterSiteChange(locationChoice.locations, siteId);
}

export function DepartmentFormDialog({
  department,
  locationChoice,
  open,
  onOpenChange,
}: DepartmentFormDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  // The site only narrows the locations. It is not sent, because the server reads the site from the location.
  const initialSiteId = department ? "" : departmentSiteDefault(locationChoice);
  const sites = locationChoice.mode === "pick" ? departmentSitesFrom(locationChoice.locations) : [];
  const pickSite = sites.length > 1;

  const form = useForm({
    defaultValues: {
      name: department?.name ?? "",
      siteId: initialSiteId,
      locationId: defaultLocationId(department, locationChoice, initialSiteId),
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
        : await createDepartment({ name: value.name, locationId: value.locationId });

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

  const siteId = useStore(form.store, (state) => state.values.siteId);
  const siteLocations = departmentLocationsFor(
    locationChoice.mode === "pick" ? locationChoice.locations : [],
    siteId,
    pickSite,
  );

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
                            placeholder="Department name"
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
                  <form.Field name="siteId">
                    {(field) => {
                      // An edit keeps the department's own location, which is shown below.
                      if (department) {
                        return null;
                      }

                      if (locationChoice.mode === "fixed") {
                        return (
                          <Field>
                            <FieldLabel>Site</FieldLabel>
                            <p className="text-sm">{locationChoice.location.siteName}</p>
                          </Field>
                        );
                      }

                      // HO has one site, already set in the default values.
                      if (!pickSite) {
                        return (
                          <Field>
                            <FieldLabel>Site</FieldLabel>
                            <p className="text-sm">{sites[0]?.name ?? "No site available"}</p>
                          </Field>
                        );
                      }

                      return (
                        <Field>
                          <FieldLabel htmlFor={field.name}>Site</FieldLabel>
                          <Select
                            value={field.state.value}
                            onValueChange={(value) => {
                              if (value && value !== field.state.value) {
                                field.handleChange(value);
                                form.setFieldValue(
                                  "locationId",
                                  departmentLocationAfterSiteChange(
                                    locationChoice.locations,
                                    value,
                                  ),
                                );
                              }
                            }}
                            items={sites.map((site) => ({ value: site.id, label: site.name }))}
                            disabled={isSubmitting}
                          >
                            <SelectTrigger id={field.name} className="w-full">
                              <SelectValue placeholder="Choose a site" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {sites.map((site) => (
                                  <SelectItem key={site.id} value={site.id}>
                                    {site.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
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
                            items={siteLocations.map((location) => ({
                              value: location.id,
                              label: location.name,
                            }))}
                            disabled={isSubmitting || !siteId}
                          >
                            <SelectTrigger
                              id={field.name}
                              aria-invalid={isInvalid || undefined}
                              className="w-full"
                            >
                              <SelectValue
                                placeholder={siteId ? "Choose a location" : "Choose a site first"}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {siteLocations.map((location) => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name}
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
