"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { WorkerStatus } from "@/types/workers";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPTIONS: { value: WorkerStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "deleted", label: "Deleted" },
];

export function WorkersStatusFilter({ status }: { status: WorkerStatus }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setStatus(next: WorkerStatus) {
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
          setStatus(value as WorkerStatus);
        }
      }}
      items={OPTIONS}
    >
      <SelectTrigger aria-label="Filter workers by status" className="h-9 w-40">
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
