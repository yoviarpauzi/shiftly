"use client";

import type { AttendanceFiltersProps } from "@/types/attendance";
import { ALL_OPTION as ALL, FilterSelect } from "@/components/dashboard/filter-select";
import { RequestsSearch } from "@/components/dashboard/requests/requests-search";

const STATUS_OPTIONS = [
  { value: ALL, label: "All statuses" },
  { value: "not-marked", label: "Not marked" },
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "sick", label: "Sick" },
  { value: "leave", label: "Leave" },
];

// Search, then site, location, department, shift, and status. The page always shows one site and one
// location, so those two pick one of the allowed values and have no "All" choice. A superadmin picks
// both, HO picks a location, and admin site sees neither. A new site resets the location,
// department, and shift, and a new location resets the department.
export function AttendanceFilters({ filters, choices }: AttendanceFiltersProps) {
  const locations = choices.locations.filter((location) => location.siteId === choices.siteId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <RequestsSearch placeholder="Search by name or employee ID" label="Search workers" />
      {choices.sites.length > 1 && (
        <FilterSelect
          param="site"
          value={choices.siteId ?? ""}
          options={choices.sites.map((site) => ({ value: site.id, label: site.name }))}
          label="Site"
          className="h-9 w-48"
          resets={["location", "department", "shift"]}
        />
      )}
      {locations.length > 1 && (
        <FilterSelect
          param="location"
          value={choices.locationId ?? ""}
          options={locations.map((location) => ({ value: location.id, label: location.name }))}
          label="Location"
          className="h-9 w-48"
          resets={["department"]}
        />
      )}
      <FilterSelect
        param="department"
        value={filters.departmentId ?? ALL}
        options={[
          { value: ALL, label: "All departments" },
          ...choices.departments.map((entry) => ({ value: entry.id, label: entry.name })),
        ]}
        label="Filter by department"
        className="h-9 w-48"
      />
      <FilterSelect
        param="shift"
        value={filters.shiftId ?? ALL}
        options={[
          { value: ALL, label: "All shifts" },
          ...choices.shifts.map((entry) => ({ value: entry.id, label: entry.name })),
        ]}
        label="Filter by shift"
        className="h-9 w-40"
      />
      <FilterSelect
        param="status"
        value={filters.status}
        options={STATUS_OPTIONS}
        label="Filter by status"
        className="h-9 w-40"
      />
    </div>
  );
}
