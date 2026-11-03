"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { addDays } from "@/app/dashboard/rosters/roster-rules";
import type { AttendanceDateRowProps } from "@/types/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

// The day being marked: previous and next day, a date picker, Today, and the two actions. Changing
// the day replaces the URL's date and keeps the other filters.
export function AttendanceDateRow({
  date,
  today,
  canSave,
  canMarkAll,
  onMarkAll,
  onSave,
  isSaving,
}: AttendanceDateRowProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goTo(next: string) {
    const params = new URLSearchParams(searchParams.toString());

    params.set("date", next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Previous day"
          onClick={() => goTo(addDays(date, -1))}
        >
          <ChevronLeftIcon />
        </Button>
        <Input
          type="date"
          value={date}
          onChange={(event) => {
            // The picker sends an empty value while a date is half typed.
            if (event.target.value) {
              goTo(event.target.value);
            }
          }}
          aria-label="Date"
          className="h-9 w-40 tabular-nums"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Next day"
          onClick={() => goTo(addDays(date, 1))}
        >
          <ChevronRightIcon />
        </Button>
        <Button type="button" variant="outline" disabled={date === today} onClick={() => goTo(today)}>
          Today
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={!canMarkAll} onClick={onMarkAll}>
          <CheckCheckIcon data-icon="inline-start" />
          Mark all as present
        </Button>
        <Button type="button" disabled={!canSave || isSaving} onClick={onSave}>
          {isSaving && <Spinner data-icon="inline-start" />}
          Save attendance
        </Button>
      </div>
    </div>
  );
}
