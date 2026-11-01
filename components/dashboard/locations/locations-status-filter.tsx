"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LocationStatus } from "@/types/locations";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPTIONS: { value: LocationStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "deleted", label: "Deleted" },
];

export function LocationsStatusFilter({ status }: { status: LocationStatus }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setStatus(next: LocationStatus) {
    const params = new URLSearchParams(searchParams.toString());

    params.set("status", next);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      value={status}
      onValueChange={(value) => {
        if (value) {
          setStatus(value as LocationStatus);
        }
      }}
      items={OPTIONS}
    >
      <SelectTrigger aria-label="Filter locations by status" className="h-9 w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
