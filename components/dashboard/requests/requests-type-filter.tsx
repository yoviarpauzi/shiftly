"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  RequestTypeFilter,
  RequestTypeFilterProps,
} from "@/types/requests";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPTIONS: { value: RequestTypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

export function RequestsTypeFilter({ type }: RequestTypeFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setType(next: RequestTypeFilter) {
    const params = new URLSearchParams(searchParams.toString());

    params.set("type", next);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select
      value={type}
      onValueChange={(value) => {
        if (value) {
          setType(value as RequestTypeFilter);
        }
      }}
      items={OPTIONS}
    >
      <SelectTrigger aria-label="Filter requests by type" className="h-9 w-36">
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
