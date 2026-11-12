import Link from "next/link";
import { CalendarX2Icon } from "lucide-react";
import type { HistoryEmptyProps } from "@/types/worker-history";
import { Button } from "@/components/ui/button";

// Three ways the history can be empty, each with its own words: the worker was never scheduled,
// the chosen month has no days, or the filters match none of the month's days.
export function HistoryEmpty(props: HistoryEmptyProps) {
  const title =
    props.kind === "none"
      ? "No work history yet"
      : props.kind === "month"
        ? `No work in ${props.monthLabel}`
        : "No days match these filters";

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border px-4 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <CalendarX2Icon aria-hidden className="size-5 text-muted-foreground" />
      </span>
      <p className="font-medium">{title}</p>
      {props.kind === "none" ? (
        <p className="text-sm text-muted-foreground">
          {props.workerName} has not been scheduled in a roster. Shifts show up here once a roster
          that includes this worker is confirmed.
        </p>
      ) : null}
      {props.kind === "month" ? (
        <p className="text-sm text-muted-foreground">Pick another month to see earlier days.</p>
      ) : null}
      {props.kind === "filtered" ? (
        <Button variant="outline" render={<Link href={props.clearHref} />} nativeButton={false}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
