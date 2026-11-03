"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RosterFiltersProps } from "@/types/rosters";
import { RequestsSearch } from "@/components/dashboard/requests/requests-search";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";

const STATUS_OPTIONS = [
  { value: ALL, label: "All roster statuses" },
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "not-generated", label: "Not generated" },
];

const TYPE_OPTIONS = [
  { value: ALL, label: "All types" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

type FilterSelectProps = {
  // The URL parameter this filter writes.
  param: string;
  value: string;
  options: { value: string; label: string }[];
  label: string;
  className: string;
  // Parameters to drop when this one changes.
  resets?: string[];
};

// One filter in the URL. "All" removes the parameter, and any change goes back to page 1.
function FilterSelect({ param, value, options, label, className, resets = [] }: FilterSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function change(next: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (next === ALL) {
      params.delete(param);
    } else {
      params.set(param, next);
    }
    for (const reset of resets) {
      params.delete(reset);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next) {
          change(next);
        }
      }}
      items={options}
    >
      <SelectTrigger aria-label={label} className={className}>
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

// Search, roster status, type, site, then location. A superadmin picks both site and location, HO
// picks a location, and admin site sees neither. The location belongs to its site, so changing the
// site drops it.
export function RostersFilters({ filters, sites, locations }: RosterFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <RequestsSearch />
      <FilterSelect
        param="status"
        value={filters.status}
        options={STATUS_OPTIONS}
        label="Filter rosters by status"
        className="h-9 w-48"
      />
      <FilterSelect
        param="type"
        value={filters.type}
        options={TYPE_OPTIONS}
        label="Filter rosters by type"
        className="h-9 w-36"
      />
      {sites.length > 0 && (
        <FilterSelect
          param="site"
          value={filters.siteId ?? ALL}
          options={[
            { value: ALL, label: "All sites" },
            ...sites.map((site) => ({ value: site.id, label: site.name })),
          ]}
          label="Filter rosters by site"
          className="h-9 w-48"
          resets={["location"]}
        />
      )}
      {locations.length > 1 && (
        <FilterSelect
          param="location"
          value={filters.locationId ?? ALL}
          options={[
            { value: ALL, label: "All locations" },
            ...locations.map((location) => ({ value: location.id, label: location.name })),
          ]}
          label="Filter rosters by location"
          className="h-9 w-48"
        />
      )}
    </div>
  );
}
