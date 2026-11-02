"use client";

import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import { nameFieldError } from "@/app/dashboard/departments/department-rules";
import { createWorker, updateWorker } from "@/app/dashboard/workers/actions";
import type { WorkerFormDialogProps, WorkerFormOptions, WorkerRow } from "@/types/workers";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { workerSchema } from "@/validation/worker";

// A fixed site starts the form on it. An edit starts on the worker's own site.
function defaultSiteId(worker: WorkerRow | null, options: WorkerFormOptions) {
  if (worker) {
    return worker.siteId;
  }

  return options.siteChoice.mode === "fixed" ? options.siteChoice.site.id : "";
}

// Admin site can only pick one location, so the form starts on it.
function defaultLocationId(worker: WorkerRow | null, options: WorkerFormOptions, siteId: string) {
  if (worker) {
    return worker.locationId;
  }

  const inSite = options.locations.filter((location) => location.siteId === siteId);

  return inSite.length === 1 ? inSite[0].id : "";
}

export function WorkerFormDialog({ worker, options, open, onOpenChange }: WorkerFormDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const initialSiteId = defaultSiteId(worker, options);

  const form = useForm({
    defaultValues: {
      employeeId: worker?.employeeId ?? "",
      name: worker?.name ?? "",
      siteId: initialSiteId,
      locationId: defaultLocationId(worker, options, initialSiteId),
      positionIds: worker?.positions.map((position) => position.id) ?? ([] as string[]),
    },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = workerSchema.safeParse(value);

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

      const result = worker
        ? await updateWorker(worker.id, value)
        : await createWorker(value);

      if (!result.ok) {
        setFormError(result.formError ?? null);
        formApi.setErrorMap({
          onSubmit: {
            form: result.formError,
            fields: {
              employeeId: nameFieldError(result.fieldErrors?.employeeId),
              name: nameFieldError(result.fieldErrors?.name),
              siteId: nameFieldError(result.fieldErrors?.siteId),
              locationId: nameFieldError(result.fieldErrors?.locationId),
              positionIds: nameFieldError(result.fieldErrors?.positionIds),
            },
          },
        });
        return;
      }

      toast.success(worker ? "Worker updated" : "Worker created");
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
            <DialogTitle>{worker ? "Edit worker" : "Add worker"}</DialogTitle>
          </DialogHeader>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <>
                <FieldGroup>
                  <form.Field name="employeeId">
                    {(field) => {
                      const isInvalid = field.state.meta.errors.length > 0;

                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Employee ID</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(event) => field.handleChange(event.target.value)}
                            autoFocus
                            disabled={isSubmitting}
                            aria-invalid={isInvalid || undefined}
                          />
                          {isInvalid && <FieldError errors={field.state.meta.errors} />}
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
                            onChange={(event) => field.handleChange(event.target.value)}
                            disabled={isSubmitting}
                            aria-invalid={isInvalid || undefined}
                          />
                          {isInvalid && <FieldError errors={field.state.meta.errors} />}
                        </Field>
                      );
                    }}
                  </form.Field>
                  <form.Field name="siteId">
                    {(field) => {
                      if (options.siteChoice.mode === "fixed") {
                        return (
                          <Field>
                            <FieldLabel>Site</FieldLabel>
                            <p className="text-sm">{options.siteChoice.site.name}</p>
                          </Field>
                        );
                      }

                      const sites = options.siteChoice.sites;
                      const isInvalid = field.state.meta.errors.length > 0;

                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Site</FieldLabel>
                          <Select
                            value={field.state.value}
                            onValueChange={(value) => {
                              if (value && value !== field.state.value) {
                                field.handleChange(value);
                                // Locations and positions belong to one site, so they start over.
                                form.setFieldValue("locationId", "");
                                form.setFieldValue("positionIds", []);
                              }
                            }}
                            items={sites.map((site) => ({ value: site.id, label: site.name }))}
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
                                {sites.map((site) => (
                                  <SelectItem key={site.id} value={site.id}>
                                    {site.name}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          {isInvalid && <FieldError errors={field.state.meta.errors} />}
                        </Field>
                      );
                    }}
                  </form.Field>
                  <form.Subscribe selector={(state) => state.values.siteId}>
                    {(siteId) => {
                      const locations = options.locations.filter(
                        (location) => location.siteId === siteId,
                      );
                      const positions = options.positions.filter(
                        (position) => position.siteId === siteId,
                      );

                      return (
                        <>
                          <form.Field name="locationId">
                            {(field) => {
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
                                    items={locations.map((location) => ({
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
                                        {locations.map((location) => (
                                          <SelectItem key={location.id} value={location.id}>
                                            {location.name}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                </Field>
                              );
                            }}
                          </form.Field>
                          <form.Field name="positionIds">
                            {(field) => {
                              const isInvalid = field.state.meta.errors.length > 0;

                              return (
                                <Field data-invalid={isInvalid || undefined}>
                                  <FieldLabel>Positions</FieldLabel>
                                  {positions.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                      {siteId ? "No positions in this site yet" : "Choose a site first"}
                                    </p>
                                  ) : (
                                    <div className="flex max-h-40 flex-col gap-2 overflow-y-auto rounded-lg border p-3">
                                      {positions.map((position) => {
                                        const checked = field.state.value.includes(position.id);

                                        return (
                                          <label
                                            key={position.id}
                                            className="flex items-center gap-2 text-sm"
                                          >
                                            <Checkbox
                                              checked={checked}
                                              disabled={isSubmitting}
                                              onCheckedChange={(value) =>
                                                field.handleChange(
                                                  value
                                                    ? [...field.state.value, position.id]
                                                    : field.state.value.filter(
                                                        (id) => id !== position.id,
                                                      ),
                                                )
                                              }
                                            />
                                            {position.name}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                </Field>
                              );
                            }}
                          </form.Field>
                        </>
                      );
                    }}
                  </form.Subscribe>
                </FieldGroup>
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
