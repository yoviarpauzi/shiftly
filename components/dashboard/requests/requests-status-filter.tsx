"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  RequestStatusFilter,
  RequestStatusFilterProps,
} from "@/types/requests";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPTIONS: { value: RequestStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

export function RequestsStatusFilter({ status }: RequestStatusFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setStatus(next: RequestStatusFilter) {
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
          setStatus(value as RequestStatusFilter);
        }
      }}
      items={OPTIONS}
    >
      <SelectTrigger aria-label="Filter requests by status" className="h-9 w-40">
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
