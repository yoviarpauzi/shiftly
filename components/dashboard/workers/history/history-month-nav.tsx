import Link from "next/link";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  historyHref,
  monthLabel,
  shiftMonth,
} from "@/app/dashboard/workers/worker-history-rules";
import type { HistoryMonthNavProps } from "@/types/worker-history";
import { Button } from "@/components/ui/button";

// Previous and next month, the month's name, and a way back to this month. History ends today, so
// next is disabled in the current month and This month has nothing to do there.
export function HistoryMonthNav({ workerId, params, month, today }: HistoryMonthNavProps) {
  const current = today.slice(0, 7);
  const isCurrent = month === current;
  const hrefFor = (target: string) => historyHref(workerId, params, { month: target });

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous month"
        render={<Link href={hrefFor(shiftMonth(month, -1))} />}
        nativeButton={false}
      >
        <ChevronLeftIcon />
      </Button>
      <span className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium sm:flex-none">
        <CalendarDaysIcon className="size-4" aria-hidden />
        {monthLabel(month)}
      </span>
      {isCurrent ? (
        <Button variant="outline" size="icon" aria-label="Next month" disabled>
          <ChevronRightIcon />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="icon"
          aria-label="Next month"
          render={<Link href={hrefFor(shiftMonth(month, 1))} />}
          nativeButton={false}
        >
          <ChevronRightIcon />
        </Button>
      )}
      {isCurrent ? (
        <Button variant="outline" disabled>
          This month
        </Button>
      ) : (
        <Button
          variant="outline"
          render={<Link href={historyHref(workerId, params, { month: null })} />}
          nativeButton={false}
        >
          This month
        </Button>
      )}
    </div>
  );
}
