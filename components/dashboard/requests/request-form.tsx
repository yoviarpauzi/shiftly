"use client";

import { useForm, useStore } from "@tanstack/react-form";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createRequest, updateRequest } from "@/app/dashboard/requests/actions";
import {
  MAX_REQUEST_LINES,
  afterSiteChange,
  blankLine,
  canAddLine,
  canRemoveLine,
  departmentsFor,
  linesAfterLocationChange,
  locationsFor,
  minStartDateFor,
  positionsFor,
  requestFormDefaults,
  returnsToPending,
  shiftsFor,
  subDepartmentsFor,
  toRequestLineInputs,
  withSiteError,
} from "@/app/dashboard/requests/request-form-options";
import {
  linesHeadcountsError,
  requestFieldErrors,
} from "@/app/dashboard/requests/request-rules";
import type {
  RequestFormFieldErrors,
  RequestFormProps,
  RequestFormValues,
} from "@/types/requests";
import { RequestLineFields } from "@/components/dashboard/requests/request-line-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
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
import { createRequestSchema, updateRequestSchema } from "@/validation/request";

const REQUESTS_PATH = "/dashboard/requests";

const REQUEST_TYPE_ITEMS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

function fieldError(message: string | undefined) {
  return message ? { message } : undefined;
}

function errorFields(errors: RequestFormFieldErrors) {
  return {
    type: fieldError(errors.type),
    startDate: fieldError(errors.startDate),
    siteId: fieldError(errors.siteId),
    locationId: fieldError(errors.locationId),
    lines: fieldError(errors.lines),
  };
}

export function RequestForm({ request, choices, readOnly }: RequestFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  // Set once a create succeeds and never reset, so the button stays off until navigation completes.
  const [created, setCreated] = useState(false);
  // Read once, so a refresh after saving does not hand the form new defaults.
  const [defaultValues] = useState(() => requestFormDefaults(request, choices));

  // The type is locked on edit, so the stored type decides how many days each line has.
  const lineType = (value: RequestFormValues) => request?.type ?? value.type;

  // The form lines turned into the headcounts the schema and the server take.
  const submitted = (value: RequestFormValues) => ({
    ...value,
    lines: toRequestLineInputs(lineType(value), value.lines),
  });

  // Exactly when the Site field below renders its picker.
  const pickSite = !request && choices.sites.length > 1;

  const form = useForm({
    defaultValues,
    // On edit the server decides the date rule: a stored date that has passed may be kept.
    validators: {
      onSubmit: ({ value }) => {
        const input = submitted(value);
        const parsed = request
          ? updateRequestSchema(null).safeParse(input)
          : createRequestSchema(minStartDateFor(choices, value.locationId)).safeParse(input);

        if (!parsed.success) {
          const errors = requestFieldErrors(parsed.error.issues);

          return { fields: errorFields(withSiteError(errors, value.siteId, pickSite)) };
        }

        // A create without a type has already failed the schema above.
        const type = lineType(value);
        const headcountError = type ? linesHeadcountsError(type, input.lines) : null;

        return headcountError
          ? { fields: errorFields({ lines: headcountError }) }
          : undefined;
      },
    },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);

      // The validator above has passed, so these parses only convert the values. The date rule is
      // left to the server, which checks it again either way.
      const input = submitted(value);
      const result = request
        ? await updateRequest(request.id, updateRequestSchema(null).parse(input))
        : await createRequest(createRequestSchema(null).parse(input));

      if (!result.ok) {
        setFormError(result.formError ?? null);
        formApi.setErrorMap({
          onSubmit: {
            form: result.formError,
            fields: errorFields(result.fieldErrors ?? {}),
          },
        });
        return;
      }

      if (!request) {
        setCreated(true);
        toast.success(`Request ${result.poNumber} created`);
        router.push(`${REQUESTS_PATH}/${result.id}`);
        return;
      }

      if (returnsToPending(request)) {
        toast.success("Request updated", {
          description: "It returned to pending and needs HO approval again.",
        });
      } else {
        toast.success("Request updated");
      }
    },
  });

  const siteId = useStore(form.store, (state) => state.values.siteId);
  const locationId = useStore(form.store, (state) => state.values.locationId);
  const type = useStore(form.store, (state) => state.values.type);
  const startDate = useStore(form.store, (state) => state.values.startDate);
  const siteLocations = locationsFor(choices, siteId);
  const departments = departmentsFor(choices, locationId);
  const positions = positionsFor(choices, locationId);
  const shifts = shiftsFor(choices, locationId);
  const isEdit = request !== null;

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        // Enter in a field submits too, so the guard is here as well as on the button.
        if (created) return;
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => {
          const disabled = isSubmitting || readOnly;

          return (
            <>
              <FieldGroup className="grid gap-6 md:grid-cols-2">
                <form.Field name="type">
                  {(field) => {
                    const isInvalid = field.state.meta.errors.length > 0;

                    return (
                      <Field data-invalid={isInvalid || undefined}>
                        <FieldLabel htmlFor={field.name}>Type</FieldLabel>
                        <Select
                          value={field.state.value || null}
                          onValueChange={(value) => {
                            if (value === "daily" || value === "weekly") {
                              field.handleChange(value);
                            }
                          }}
                          items={REQUEST_TYPE_ITEMS}
                          disabled={disabled || isEdit}
                        >
                          <SelectTrigger
                            id={field.name}
                            className="w-full"
                            aria-invalid={isInvalid || undefined}
                          >
                            <SelectValue placeholder="Choose a type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {REQUEST_TYPE_ITEMS.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
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
                <form.Field name="startDate">
                  {(field) => {
                    const isInvalid = field.state.meta.errors.length > 0;

                    return (
                      <Field data-invalid={isInvalid || undefined}>
                        <FieldLabel htmlFor={field.name}>Start date</FieldLabel>
                        <Input
                          id={field.name}
                          name={field.name}
                          type="date"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          disabled={disabled}
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
                    // The site is fixed after creation.
                    if (request) {
                      return (
                        <Field>
                          <FieldLabel htmlFor={field.name}>Site</FieldLabel>
                          <Input
                            id={field.name}
                            value={request.siteName}
                            disabled
                            readOnly
                          />
                        </Field>
                      );
                    }

                    // HO and admin site have one site, already set in the default values.
                    if (choices.sites.length <= 1) {
                      return (
                        <Field>
                          <FieldLabel>Site</FieldLabel>
                          <p className="text-sm">
                            {choices.sites[0]?.name ?? "No site available"}
                          </p>
                        </Field>
                      );
                    }

                    const isInvalid = field.state.meta.errors.length > 0;

                    return (
                      <Field data-invalid={isInvalid || undefined}>
                        <FieldLabel htmlFor={field.name}>Site</FieldLabel>
                        <Select
                          value={field.state.value || null}
                          onValueChange={(value) => {
                            if (value && value !== field.state.value) {
                              const next = afterSiteChange(choices, value);

                              field.handleChange(value);
                              form.setFieldValue("locationId", next.locationId);
                              form.setFieldValue("lines", next.lines);
                            }
                          }}
                          items={choices.sites.map((row) => ({
                            value: row.id,
                            label: row.name,
                          }))}
                          disabled={disabled}
                        >
                          <SelectTrigger
                            id={field.name}
                            className="w-full"
                            aria-invalid={isInvalid || undefined}
                          >
                            <SelectValue placeholder="Choose a site" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {choices.sites.map((row) => (
                                <SelectItem key={row.id} value={row.id}>
                                  {row.name}
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
                <form.Field name="locationId">
                  {(field) => {
                    const isInvalid = field.state.meta.errors.length > 0;
                    const error = isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    );

                    // The location is fixed after creation.
                    if (request) {
                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Location</FieldLabel>
                          <Input
                            id={field.name}
                            value={request.locationName}
                            disabled
                            readOnly
                          />
                          {error}
                        </Field>
                      );
                    }

                    // A site with one location (or none) leaves nothing to choose. The one
                    // location is already set in the default values and by a site change.
                    if (siteId && siteLocations.length <= 1) {
                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel>Location</FieldLabel>
                          <p className="text-sm">
                            {siteLocations[0]?.name ?? "No location available"}
                          </p>
                          {error}
                        </Field>
                      );
                    }

                    return (
                      <Field data-invalid={isInvalid || undefined}>
                        <FieldLabel htmlFor={field.name}>Location</FieldLabel>
                        <Select
                          value={field.state.value || null}
                          onValueChange={(value) => {
                            if (value && value !== field.state.value) {
                              field.handleChange(value);
                              form.setFieldValue(
                                "lines",
                                linesAfterLocationChange(),
                              );
                            }
                          }}
                          items={siteLocations.map((row) => ({
                            value: row.id,
                            label: row.name,
                          }))}
                          disabled={disabled || !siteId}
                        >
                          <SelectTrigger
                            id={field.name}
                            className="w-full"
                            aria-invalid={isInvalid || undefined}
                          >
                            <SelectValue
                              placeholder={
                                siteId
                                  ? "Choose a location"
                                  : "Choose a site first"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {siteLocations.map((row) => (
                                <SelectItem key={row.id} value={row.id}>
                                  {row.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        {error}
                      </Field>
                    );
                  }}
                </form.Field>
              </FieldGroup>
              <form.Field name="lines" mode="array">
                {(field) => {
                  const lines = field.state.value;
                  const isInvalid = field.state.meta.errors.length > 0;

                  return (
                    <FieldSet data-invalid={isInvalid || undefined}>
                      <FieldLegend>Lines</FieldLegend>
                      <FieldDescription>
                        {locationId
                          ? `Headcount per department, position, and shift, up to ${MAX_REQUEST_LINES} lines. Any shift lets the roster split it.`
                          : "Choose a location to see its departments, positions, and shifts."}
                      </FieldDescription>
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                      <div className="flex flex-col gap-3">
                        {lines.map((line, index) => (
                          <RequestLineFields
                            key={index}
                            index={index}
                            line={line}
                            type={type}
                            startDate={startDate}
                            departments={departments}
                            subDepartments={subDepartmentsFor(
                              choices,
                              line.departmentId,
                            )}
                            positions={positions}
                            shifts={shifts}
                            disabled={disabled}
                            canRemove={canRemoveLine(lines.length)}
                            showRemove={!readOnly}
                            onChange={(next) => field.replaceValue(index, next)}
                            onRemove={() => field.removeValue(index)}
                          />
                        ))}
                      </div>
                      {!readOnly && (
                        <Button
                          type="button"
                          variant="outline"
                          className="self-start"
                          onClick={() => field.pushValue(blankLine())}
                          disabled={disabled || !canAddLine(lines.length)}
                        >
                          <PlusIcon data-icon="inline-start" />
                          Add line
                        </Button>
                      )}
                    </FieldSet>
                  );
                }}
              </form.Field>
              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Link
                  href={REQUESTS_PATH}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Back to requests
                </Link>
                {!readOnly && (
                  <Button type="submit" disabled={isSubmitting || created}>
                    {isSubmitting && <Spinner data-icon="inline-start" />}
                    {isEdit ? "Save changes" : "Create request"}
                  </Button>
                )}
              </div>
            </>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
