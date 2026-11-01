"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DepartmentLocationOption } from "@/types/departments";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_LOCATIONS = "all";

export function DepartmentsLocationFilter({
  locationId,
  locations,
}: {
  locationId: string | null;
  locations: DepartmentLocationOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const options = [
    { value: ALL_LOCATIONS, label: "All locations" },
    ...locations.map((location) => ({
      value: location.id,
      label: `${location.name} (${location.siteName})`,
    })),
  ];

  function setLocation(next: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (next === ALL_LOCATIONS) {
      params.delete("location");
    } else {
      params.set("location", next);
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      value={locationId ?? ALL_LOCATIONS}
      onValueChange={(value) => {
        if (value) {
          setLocation(value);
        }
      }}
      items={options}
    >
      <SelectTrigger aria-label="Filter departments by location" className="h-9 w-56">
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
