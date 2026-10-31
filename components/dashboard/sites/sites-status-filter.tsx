"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SiteStatus } from "@/app/dashboard/sites/site-rules";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const OPTIONS: { value: SiteStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "deleted", label: "Deleted" },
  { value: "all", label: "All" },
];

export function SitesStatusFilter({ status }: { status: SiteStatus }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setStatus(next: SiteStatus) {
    const params = new URLSearchParams(searchParams.toString());

    params.set("status", next);
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <ToggleGroup
      value={[status]}
      variant="outline"
      size="sm"
      onValueChange={(values) => {
        const next = values[0] as SiteStatus | undefined;

        if (next) {
          setStatus(next);
        }
      }}
    >
      {OPTIONS.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
