"use client";

import type { AttendanceFiltersProps } from "@/types/attendance";
import {
  ALL_OPTION as ALL,
  FilterSelect,
} from "@/components/dashboard/filter-select";
import { RequestsSearch } from "@/components/dashboard/requests/requests-search";

const STATUS_OPTIONS = [
  { value: ALL, label: "All statuses" },
  { value: "not-marked", label: "Not marked" },
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "sick", label: "Sick" },
  { value: "leave", label: "Leave" },
];

// Search, then location, department, shift, and status. Location can be All, which only views:
// marking needs one location. HO picks a location and admin site, which has one, does not. The
// department and shift belong to one location, so they need a location, and a new location resets
// both.
export function AttendanceFilters({
  filters,
  choices,
}: AttendanceFiltersProps) {
  const showLocation = choices.locations.length > 1;
  const noLocation = choices.locationId === null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <RequestsSearch
        placeholder="Search by name or ID"
        label="Search workers"
      />
      {showLocation && (
        <FilterSelect
          param="location"
          value={choices.locationId ?? ALL}
          options={[
            { value: ALL, label: "All locations" },
            ...choices.locations.map((location) => ({
              value: location.id,
              label: location.name,
            })),
          ]}
          label="Location"
          className="h-9 w-40"
          resets={["department", "shift"]}
        />
      )}
      <FilterSelect
        param="department"
        value={filters.departmentId ?? ALL}
        options={[
          { value: ALL, label: "All departments" },
          ...choices.departments.map((entry) => ({
            value: entry.id,
            label: entry.name,
          })),
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
          ...choices.shifts.map((entry) => ({
            value: entry.id,
            label: entry.name,
          })),
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
