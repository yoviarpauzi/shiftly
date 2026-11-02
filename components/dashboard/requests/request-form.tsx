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
  blankLine,
  canAddLine,
  canRemoveLine,
  departmentsFor,
  linesAfterLocationChange,
  positionsFor,
  requestFormDefaults,
  returnsToPending,
  subDepartmentsFor,
} from "@/app/dashboard/requests/request-form-options";
import { requestFieldErrors } from "@/app/dashboard/requests/request-rules";
import { jakartaDate } from "@/lib/jakarta-date";
import type { RequestFieldErrors, RequestFormProps } from "@/types/requests";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createRequestSchema, updateRequestSchema } from "@/validation/request";

const REQUESTS_PATH = "/dashboard/requests";

function fieldError(message: string | undefined) {
  return message ? { message } : undefined;
}

function errorFields(errors: RequestFieldErrors) {
  return {
    type: fieldError(errors.type),
    startDate: fieldError(errors.startDate),
    locationId: fieldError(errors.locationId),
    note: fieldError(errors.note),
    lines: fieldError(errors.lines),
  };
}

export function RequestForm({ request, choices, readOnly }: RequestFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  // Read once, so a refresh after saving does not hand the form new defaults.
  const [defaultValues] = useState(() => requestFormDefaults(request, choices));

  const form = useForm({
    defaultValues,
    // On edit the server decides the date rule: a stored date that has passed may be kept.
    validators: {
      onSubmit: ({ value }) => {
        const parsed = request
          ? updateRequestSchema(null).safeParse(value)
          : createRequestSchema(jakartaDate()).safeParse(value);

        if (parsed.success) {
          return undefined;
        }

        return { fields: errorFields(requestFieldErrors(parsed.error.issues)) };
      },
    },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);

      // The validator above has passed, so these parses only convert the values. The date rule is
      // left to the server, which checks it again either way.
      const result = request
        ? await updateRequest(request.id, updateRequestSchema(null).parse(value))
        : await createRequest(createRequestSchema(null).parse(value));

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

  const locationId = useStore(form.store, (state) => state.values.locationId);
  const departments = departmentsFor(choices, locationId);
  const positions = positionsFor(choices, locationId);
  const isEdit = request !== null;

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
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
                      <FieldSet data-invalid={isInvalid || undefined}>
                        <FieldLegend variant="label">Type</FieldLegend>
                        <FieldDescription>
                          A daily request is approved on save. A weekly request waits for HO.
                        </FieldDescription>
                        <RadioGroup
                          value={field.state.value || null}
                          onValueChange={(value) => {
                            if (value === "daily" || value === "weekly") {
                              field.handleChange(value);
                            }
                          }}
                          disabled={disabled || isEdit}
                          aria-invalid={isInvalid || undefined}
                          className="flex gap-6"
                        >
                          <Field orientation="horizontal" className="w-auto">
                            <RadioGroupItem
                              value="daily"
                              id="type-daily"
                              aria-invalid={isInvalid || undefined}
                            />
                            <FieldLabel htmlFor="type-daily" className="font-normal">
                              Daily
                            </FieldLabel>
                          </Field>
                          <Field orientation="horizontal" className="w-auto">
                            <RadioGroupItem
                              value="weekly"
                              id="type-weekly"
                              aria-invalid={isInvalid || undefined}
                            />
                            <FieldLabel htmlFor="type-weekly" className="font-normal">
                              Weekly
                            </FieldLabel>
                          </Field>
                        </RadioGroup>
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </FieldSet>
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
                          onChange={(event) => field.handleChange(event.target.value)}
                          disabled={disabled}
                          aria-invalid={isInvalid || undefined}
                        />
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </Field>
                    );
                  }}
                </form.Field>
                <form.Field name="locationId">
                  {(field) => {
                    const isInvalid = field.state.meta.errors.length > 0;
                    const error = isInvalid && <FieldError errors={field.state.meta.errors} />;

                    // The location is fixed after creation.
                    if (request) {
                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel htmlFor={field.name}>Location</FieldLabel>
                          <Input id={field.name} value={request.locationName} disabled readOnly />
                          {error}
                        </Field>
                      );
                    }

                    // Admin site has one location, already set in the default values.
                    if (choices.locations.length <= 1) {
                      return (
                        <Field data-invalid={isInvalid || undefined}>
                          <FieldLabel>Location</FieldLabel>
                          <p className="text-sm">
                            {choices.locations[0]?.name ?? "No location available"}
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
                              form.setFieldValue("lines", linesAfterLocationChange());
                            }
                          }}
                          items={choices.locations.map((row) => ({
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
                            <SelectValue placeholder="Choose a location" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {choices.locations.map((row) => (
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
                <form.Field name="note">
                  {(field) => {
                    const isInvalid = field.state.meta.errors.length > 0;

                    return (
                      <Field data-invalid={isInvalid || undefined}>
                        <FieldLabel htmlFor={field.name}>Note</FieldLabel>
                        <Textarea
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          maxLength={500}
                          placeholder="Optional"
                          disabled={disabled}
                          aria-invalid={isInvalid || undefined}
                        />
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
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
                          ? `Headcount per department and position, up to ${MAX_REQUEST_LINES} lines.`
                          : "Choose a location to see its departments and positions."}
                      </FieldDescription>
                      {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      <div className="flex flex-col gap-3">
                        {lines.map((line, index) => (
                          <RequestLineFields
                            key={index}
                            index={index}
                            line={line}
                            departments={departments}
                            subDepartments={subDepartmentsFor(choices, line.departmentId)}
                            positions={positions}
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
                <Link href={REQUESTS_PATH} className={buttonVariants({ variant: "outline" })}>
                  Back to requests
                </Link>
                {!readOnly && (
                  <Button type="submit" disabled={isSubmitting}>
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
