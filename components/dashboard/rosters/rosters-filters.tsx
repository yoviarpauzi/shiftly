"use client";

import type { RosterFiltersProps } from "@/types/rosters";
import { ALL_OPTION as ALL, FilterSelect } from "@/components/dashboard/filter-select";
import { RequestsSearch } from "@/components/dashboard/requests/requests-search";

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
