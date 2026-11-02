"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RequestSiteFilterProps } from "@/types/requests";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_SITES = "all";

export function RequestsSiteFilter({ siteId, sites }: RequestSiteFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const options = [
    { value: ALL_SITES, label: "All sites" },
    ...sites.map((site) => ({ value: site.id, label: site.name })),
  ];

  // The location belongs to the old site, so it is dropped with the change.
  function setSite(next: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (next === ALL_SITES) {
      params.delete("site");
    } else {
      params.set("site", next);
    }
    params.delete("location");
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      value={siteId ?? ALL_SITES}
      onValueChange={(value) => {
        if (value) {
          setSite(value);
        }
      }}
      items={options}
    >
      <SelectTrigger aria-label="Filter requests by site" className="h-9 w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
