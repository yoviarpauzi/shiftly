import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { OverviewHeaderProps } from "@/types/dashboard";

export function OverviewHeader({ role, subtitle }: OverviewHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {role === "admin_site" ? (
        <Button
          className="min-h-11 w-full sm:min-h-8 sm:w-auto"
          render={<Link href="/dashboard/attendance" />}
          nativeButton={false}
        >
          Mark attendance
        </Button>
      ) : null}
    </div>
  );
}
