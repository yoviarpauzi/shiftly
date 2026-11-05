"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ShiftStatus } from "@/types/shifts";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPTIONS: { value: ShiftStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "deleted", label: "Deleted" },
];

export function ShiftsStatusFilter({ status }: { status: ShiftStatus }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setStatus(next: ShiftStatus) {
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
          setStatus(value as ShiftStatus);
        }
      }}
      items={OPTIONS}
    >
      <SelectTrigger aria-label="Filter shifts by status" className="h-9 w-40">
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
