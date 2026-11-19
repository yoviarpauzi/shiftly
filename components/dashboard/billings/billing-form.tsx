"use client";

import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBilling } from "@/app/dashboard/billings/actions";
import { defaultPeriodInput } from "@/app/dashboard/billings/billing-period";
import { billingFormErrors } from "@/app/dashboard/billings/billing-rules";
import { ACTION_FAILED_MESSAGE } from "@/app/dashboard/requests/request-rules";
import { BillingPeriodFields } from "@/components/dashboard/billings/billing-period-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
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
import type {
  BillingActionResult,
  BillingFormErrors,
  BillingFormProps,
  BillingLocationChoice,
} from "@/types/billings";
import { createBillingSchema, type CreateBillingInput } from "@/validation/billings";

const BILLINGS_PATH = "/dashboard/billings";

function fieldError(message: string | undefined) {
  return message ? { message } : undefined;
}

function errorFields(errors: BillingFormErrors) {
  return {
    locationId: fieldError(errors.locationId),
    period: fieldError(errors.period),
  };
}

function locationLabel(choice: BillingLocationChoice) {
  return choice.siteName ? `${choice.siteName} - ${choice.name}` : choice.name;
}

export function BillingForm({ locations, today }: BillingFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  // Set once a create succeeds and never reset, so the button stays off until navigation completes.
  const [created, setCreated] = useState(false);
  // Read once, so a refresh after saving does not hand the form new defaults.
  const [defaultValues] = useState<CreateBillingInput>(() => ({
    // One location (admin site, or an HO with one) leaves nothing to choose.
    locationId: locations.length === 1 ? locations[0].id : "",
    period: defaultPeriodInput("monthly", today),
  }));

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: ({ value }) => {
        const parsed = createBillingSchema.safeParse(value);

        return parsed.success
          ? undefined
          : { fields: errorFields(billingFormErrors(parsed.error.issues)) };
      },
    },
    onSubmit: async ({ value, formApi }) => {
      setFormError(null);

      let result: BillingActionResult;

      try {
        // The validator above has passed, so this parse only narrows the type.
        result = await createBilling(createBillingSchema.parse(value));
      } catch {
        setFormError(ACTION_FAILED_MESSAGE);
        formApi.setErrorMap({ onSubmit: { form: ACTION_FAILED_MESSAGE } });
        return;
      }

      if (!result.ok) {
        setFormError(result.formError);
        formApi.setErrorMap({ onSubmit: { form: result.formError } });
        return;
      }

      setCreated(true);
      router.push(`${BILLINGS_PATH}/${result.id}`);
    },
  });

  return (
    <form
      className="flex max-w-2xl flex-col gap-6"
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
          const disabled = isSubmitting || created;

          return (
            <>
              <FieldGroup>
                <form.Field name="locationId">
                  {(field) => {
                    const isInvalid = field.state.meta.errors.length > 0;
                    const fixed = locations.length === 1 ? locations[0] : null;

                    if (fixed) {
                      return (
                        <Field>
                          <FieldLabel htmlFor={field.name}>Location</FieldLabel>
                          <Input id={field.name} value={locationLabel(fixed)} disabled readOnly />
                        </Field>
                      );
                    }

                    const items = locations.map((row) => ({
                      value: row.id,
                      label: locationLabel(row),
                    }));

                    return (
                      <Field data-invalid={isInvalid || undefined}>
                        <FieldLabel htmlFor={field.name}>Location</FieldLabel>
                        <Select
                          value={field.state.value || null}
                          onValueChange={(value) => {
                            if (value) field.handleChange(value);
                          }}
                          items={items}
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
                              {items.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
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
                <form.Field name="period">
                  {(field) => {
                    const isInvalid = field.state.meta.errors.length > 0;

                    return (
                      <FieldSet data-invalid={isInvalid || undefined}>
                        <FieldLegend variant="label">Period</FieldLegend>
                        <BillingPeriodFields
                          value={field.state.value}
                          onChange={field.handleChange}
                          disabled={disabled}
                        />
                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                      </FieldSet>
                    );
                  }}
                </form.Field>
              </FieldGroup>
              {formError && (
                <p role="alert" className="text-sm text-destructive">
                  {formError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Link href={BILLINGS_PATH} className={buttonVariants({ variant: "outline" })}>
                  Back to billing
                </Link>
                <Button type="submit" disabled={disabled}>
                  {isSubmitting && <Spinner data-icon="inline-start" />}
                  Create draft
                </Button>
              </div>
            </>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
