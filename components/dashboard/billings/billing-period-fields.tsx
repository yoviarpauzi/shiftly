"use client";

import { useId } from "react";
import { defaultPeriodInput, periodFor } from "@/app/dashboard/billings/billing-period";
import { formatBillingPeriod } from "@/app/dashboard/billings/billing-rules";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dateInZone } from "@/lib/indonesia-date";
import type { BillingMode, BillingPeriodFieldsProps } from "@/types/billings";
import { DEFAULT_LOCATION_TIMEZONE } from "@/validation/location";

const MODES: { value: BillingMode; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom" },
];

function isBillingMode(value: unknown): value is BillingMode {
  return MODES.some((mode) => mode.value === value);
}

export function BillingPeriodFields({ value, onChange, disabled }: BillingPeriodFieldsProps) {
  const id = useId();
  const period = periodFor(value);

  return (
    <div className="flex flex-col gap-3">
      <Tabs
        value={value.mode}
        onValueChange={(mode) => {
          // Read in the handler, not in render, so the server and the browser never disagree.
          if (isBillingMode(mode) && mode !== value.mode) {
            onChange(defaultPeriodInput(mode, dateInZone(DEFAULT_LOCATION_TIMEZONE)));
          }
        }}
      >
        <TabsList aria-label="Period type">
          {MODES.map((mode) => (
            <TabsTrigger key={mode.value} value={mode.value} disabled={disabled}>
              {mode.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="monthly" className="pt-2">
          {value.mode === "monthly" && (
            <Field>
              <FieldLabel htmlFor={`${id}-month`}>Month</FieldLabel>
              <Input
                id={`${id}-month`}
                type="month"
                placeholder="YYYY-MM"
                value={value.month}
                onChange={(event) => onChange({ mode: "monthly", month: event.target.value })}
                disabled={disabled}
              />
            </Field>
          )}
        </TabsContent>
        <TabsContent value="weekly" className="pt-2">
          {value.mode === "weekly" && (
            <Field>
              <FieldLabel htmlFor={`${id}-date`}>Any day in the week</FieldLabel>
              <Input
                id={`${id}-date`}
                type="date"
                value={value.date}
                onChange={(event) => onChange({ mode: "weekly", date: event.target.value })}
                disabled={disabled}
              />
            </Field>
          )}
        </TabsContent>
        <TabsContent value="custom" className="pt-2">
          {value.mode === "custom" && (
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor={`${id}-from`}>From</FieldLabel>
                <Input
                  id={`${id}-from`}
                  type="date"
                  value={value.from}
                  onChange={(event) =>
                    onChange({ mode: "custom", from: event.target.value, to: value.to })
                  }
                  disabled={disabled}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-to`}>To</FieldLabel>
                <Input
                  id={`${id}-to`}
                  type="date"
                  value={value.to}
                  onChange={(event) =>
                    onChange({ mode: "custom", from: value.from, to: event.target.value })
                  }
                  disabled={disabled}
                />
              </Field>
            </FieldGroup>
          )}
        </TabsContent>
      </Tabs>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {period ? (
          <>
            Period: <span className="text-foreground">{formatBillingPeriod(period.from, period.to)}</span>
          </>
        ) : (
          "Choose a valid period"
        )}
      </p>
    </div>
  );
}
