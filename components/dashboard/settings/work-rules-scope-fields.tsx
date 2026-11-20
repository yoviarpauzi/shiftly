"use client";

import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { settingsHref } from "@/app/dashboard/settings/settings-rules";
import { Field, FieldLabel, FieldTitle } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  SettingsTarget,
  WorkRuleScope,
  WorkRulesScopeFieldsProps,
} from "@/types/settings";

const SCOPES: { value: WorkRuleScope; label: string }[] = [
  { value: "global", label: "Global" },
  { value: "location", label: "Location" },
];

// The level picker at the top of every card. Every card reads the same URL, so all seven cards
// always show the same level. A fixed location is plain text.
export function WorkRulesScopeFields({
  scope,
  locationChoice,
  locationId,
  noLocation = false,
}: WorkRulesScopeFieldsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const id = useId();

  const go = (target: SettingsTarget) => {
    startTransition(() => {
      router.replace(settingsHref(target), { scroll: false });
    });
  };

  const showLocation = scope === "location" && !noLocation && locationChoice !== null;

  return (
    <div className="flex flex-col gap-3" aria-busy={isPending || undefined}>
      <Tabs
        value={scope}
        onValueChange={(value) => {
          if (value !== scope) {
            go({ scope: value as WorkRuleScope, locationId });
          }
        }}
      >
        <TabsList aria-label="Level">
          {SCOPES.map((item) => (
            <TabsTrigger key={item.value} value={item.value} disabled={isPending}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {showLocation && (
        <Field className="min-w-0">
          {locationChoice.mode === "fixed" ? (
            <>
              <FieldTitle>Location</FieldTitle>
              <p className="truncate text-sm">{locationChoice.location.name}</p>
            </>
          ) : (
            <>
              <FieldLabel htmlFor={`${id}-location`}>Location</FieldLabel>
              <Select
                value={locationId}
                onValueChange={(value) => {
                  if (value && value !== locationId) {
                    go({ scope, locationId: value });
                  }
                }}
                items={locationChoice.locations.map((location) => ({
                  value: location.id,
                  label: location.name,
                }))}
                disabled={isPending}
              >
                <SelectTrigger id={`${id}-location`} className="w-full">
                  <SelectValue placeholder="Choose a location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {locationChoice.locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </>
          )}
        </Field>
      )}
    </div>
  );
}
