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
  { value: "site", label: "Site" },
  { value: "location", label: "Location" },
];

// The level picker at the top of every card. Every card reads the same URL, so all six cards
// always show the same level. A fixed site or location is plain text.
export function WorkRulesScopeFields({
  scope,
  siteChoice,
  locationChoice,
  siteId,
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

  const showSite = scope !== "global" && (!noLocation || siteChoice.mode === "pick");
  const showLocation = scope === "location" && !noLocation && locationChoice !== null;

  return (
    <div className="flex flex-col gap-3" aria-busy={isPending || undefined}>
      <Tabs
        value={scope}
        onValueChange={(value) => {
          if (value !== scope) {
            go({ scope: value as WorkRuleScope, siteId, locationId });
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
      {(showSite || showLocation) && (
        <div className="flex gap-3">
          {showSite && (
            <Field className="min-w-0 flex-1">
              {siteChoice.mode === "fixed" ? (
                <>
                  <FieldTitle>Site</FieldTitle>
                  <p className="truncate text-sm">{siteChoice.site.name}</p>
                </>
              ) : (
                <>
                  <FieldLabel htmlFor={`${id}-site`}>Site</FieldLabel>
                  <Select
                    value={siteId}
                    onValueChange={(value) => {
                      if (value && value !== siteId) {
                        // Locations belong to one site, so the page starts on its first one.
                        go({ scope, siteId: value, locationId: null });
                      }
                    }}
                    items={siteChoice.sites.map((site) => ({ value: site.id, label: site.name }))}
                    disabled={isPending}
                  >
                    <SelectTrigger id={`${id}-site`} className="w-full">
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
                </>
              )}
            </Field>
          )}
          {showLocation && (
            <Field className="min-w-0 flex-1">
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
                        go({ scope, siteId, locationId: value });
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
      )}
    </div>
  );
}
