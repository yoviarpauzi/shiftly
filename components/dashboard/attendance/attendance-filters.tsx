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

// Search, then site, location, department, shift, and status. Site and location can be All, which
// only views: marking needs one location. A superadmin picks both, HO picks a location, and admin
// site sees neither. The location needs a site first, and the department and shift, which belong to
// one location, need a location. A new site resets the location, department, and shift, and a new
// location resets the department and shift.
export function AttendanceFilters({ filters, choices }: AttendanceFiltersProps) {
  const locations = choices.locations.filter((location) => location.siteId === choices.siteId);
  const showLocation =
    choices.siteId === null ? choices.sites.length > 1 : locations.length > 1;
  const noLocation = choices.locationId === null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <RequestsSearch placeholder="Search by name or employee ID" label="Search workers" />
      {choices.sites.length > 1 && (
        <FilterSelect
          param="site"
          value={choices.siteId ?? ALL}
          options={[
            { value: ALL, label: "All sites" },
            ...choices.sites.map((site) => ({ value: site.id, label: site.name })),
          ]}
          label="Site"
          className="h-9 w-32"
          resets={["location", "department", "shift"]}
        />
      )}
      {showLocation && (
        <FilterSelect
          param="location"
          value={choices.locationId ?? ALL}
          options={[
            { value: ALL, label: "All locations" },
            ...locations.map((location) => ({ value: location.id, label: location.name })),
          ]}
          label="Location"
          className="h-9 w-40"
          resets={["department", "shift"]}
          disabled={choices.siteId === null}
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
        className="h-9 w-40"
        disabled={noLocation}
      />
      <FilterSelect
        param="shift"
        value={filters.shiftId ?? ALL}
        options={[
          { value: ALL, label: "All shifts" },
          ...choices.shifts.map((entry) => ({ value: entry.id, label: entry.name })),
        ]}
        label="Filter by shift"
        className="h-9 w-32"
        disabled={noLocation}
      />
      <FilterSelect
        param="status"
        value={filters.status}
        options={STATUS_OPTIONS}
        label="Filter by status"
        className="h-9 w-36"
      />
    </div>
  );
}
