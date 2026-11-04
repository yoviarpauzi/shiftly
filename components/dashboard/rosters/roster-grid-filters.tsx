"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { shiftLabel } from "@/app/dashboard/rosters/roster-rules";
import type { RosterGridFiltersProps } from "@/types/rosters";
import { ALL_OPTION as ALL } from "@/components/dashboard/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type GridSelectProps = {
  value: string | null;
  options: { value: string; label: string }[];
  label: string;
  className: string;
  disabled?: boolean;
  onChange: (value: string | null) => void;
};

// A filter that lives in the page's state. The "all" option clears it.
function GridSelect({ value, options, label, className, disabled, onChange }: GridSelectProps) {
  return (
    <Select
      value={value ?? ALL}
      disabled={disabled}
      onValueChange={(next) => {
        if (next) {
          onChange(next === ALL ? null : next);
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

// Search a worker, then department, sub-department, position, and shift. They narrow the grid and
// nothing else: the summary above it and the panels below it still describe the whole roster. The
// sub-department choices follow the department, and a new department drops the sub-department.
export function RosterGridFilters({
  filters,
  options,
  shifts,
  summary,
  onChange,
  onClear,
}: RosterGridFiltersProps) {
  const filtered =
    filters.search !== "" ||
    filters.departmentId !== null ||
    filters.subDepartmentId !== null ||
    filters.positionId !== null ||
    filters.shiftId !== null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Escape" && filters.search !== "") {
                onChange({ search: "" });
              }
            }}
            placeholder="Search by name or employee ID"
            aria-label="Search workers"
            className="h-9 pr-10 pl-8 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {filters.search !== "" && (
            <button
              type="button"
              onClick={() => onChange({ search: "" })}
              aria-label="Clear search"
              className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        <GridSelect
          value={filters.departmentId}
          options={[
            { value: ALL, label: "All departments" },
            ...options.departments.map(({ id, name }) => ({ value: id, label: name })),
          ]}
          label="Filter by department"
          className="h-9 w-44"
          onChange={(departmentId) => onChange({ departmentId, subDepartmentId: null })}
        />
        <GridSelect
          value={filters.subDepartmentId}
          options={[
            { value: ALL, label: "All sub departments" },
            ...options.subDepartments.map(({ id, name }) => ({ value: id, label: name })),
          ]}
          label="Filter by sub department"
          className="h-9 w-48"
          disabled={options.subDepartments.length === 0}
          onChange={(subDepartmentId) => onChange({ subDepartmentId })}
        />
        <GridSelect
          value={filters.positionId}
          options={[
            { value: ALL, label: "All positions" },
            ...options.positions.map(({ id, name }) => ({ value: id, label: name })),
          ]}
          label="Filter by position"
          className="h-9 w-44"
          onChange={(positionId) => onChange({ positionId })}
        />
        <GridSelect
          value={filters.shiftId}
          options={[
            { value: ALL, label: "All shifts" },
            ...shifts.map((shift) => ({ value: shift.id, label: shiftLabel(shift.order) })),
          ]}
          label="Filter by shift"
          className="h-9 w-36"
          onChange={(shiftId) => onChange({ shiftId })}
        />
        {filtered && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {summary}
      </p>
    </div>
  );
}
