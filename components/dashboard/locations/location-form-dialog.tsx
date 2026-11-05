"use client";

import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import {
  createLocation,
  updateLocation,
} from "@/app/dashboard/locations/actions";
import { nameFieldError } from "@/app/dashboard/locations/location-rules";
import type {
  LocationFormDialogProps,
  LocationRow,
  SiteChoice,
} from "@/types/locations";
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
import { timezoneOptionLabel } from "@/lib/location-timezone";
import {
  DEFAULT_LOCATION_TIMEZONE,
  LOCATION_TIMEZONES,
  locationSchema,
  locationTimezoneSchema,
} from "@/validation/location";

// HO's site is fixed, so the form starts on it. Superadmin starts on the location's site, or empty for a new one.
function defaultSiteId(location: LocationRow | null, siteChoice: SiteChoice) {
  if (siteChoice.mode === "fixed") {
    return siteChoice.site.id;
  }

  return location?.siteId ?? "";
}

export function LocationFormDialog({
  location,
  siteChoice,
  open,
  onOpenChange,
}: LocationFormDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: location?.name ?? "",
      siteId: defaultSiteId(location, siteChoice),
      timezone: location?.timezone ?? DEFAULT_LOCATION_TIMEZONE,
    },
    validators: { onSubmit: locationSchema },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);

      const result = location
        ? await updateLocation(location.id, value)
        : await createLocation(value);

      if (!result.ok) {
        setFormError(result.formError ?? null);
        formApi.setErrorMap({
          onSubmit: {
            form: result.formError,
            fields: {
              name: nameFieldError(result.fieldErrors?.name),
              siteId: nameFieldError(result.fieldErrors?.siteId),
              timezone: nameFieldError(result.fieldErrors?.timezone),
            },
          },
        });
        return;
      }

      toast.success(location ? "Location updated" : "Location created");
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
              {location ? "Edit location" : "Add location"}
            </DialogTitle>
          </DialogHeader>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <>
                <FieldGroup>
                  <form.Field name="siteId">
                    {(field) => {
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
                  <form.Field name="timezone">
                    {(field) => {
                      const isInvalid = field.state.meta.errors.length > 0;

                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>
                            Time zone
                          </FieldLabel>
                          <Select
                            value={field.state.value}
                            onValueChange={(value) => {
                              const zone =
                                locationTimezoneSchema.safeParse(value);

                              if (zone.success) {
                                field.handleChange(zone.data);
                              }
                            }}
                            items={LOCATION_TIMEZONES.map((zone) => ({
                              value: zone,
                              label: timezoneOptionLabel(zone),
                            }))}
                            disabled={isSubmitting}
                          >
                            <SelectTrigger
                              id={field.name}
                              aria-invalid={isInvalid || undefined}
                              className="w-full"
                            >
                              <SelectValue placeholder="Choose a time zone" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {LOCATION_TIMEZONES.map((zone) => (
                                  <SelectItem key={zone} value={zone}>
                                    {timezoneOptionLabel(zone)}
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
                    render={
                      <Button variant="outline" disabled={isSubmitting} />
                    }
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
