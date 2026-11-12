import type { HistorySummaryProps } from "@/types/worker-history";
import { cn } from "@/lib/utils";

// Eight counts for the month, as compact tiles. They ignore the table's filters, so they do not
// move when one changes. The tones are the ones Attendance uses.
export function HistorySummary({ summary }: HistorySummaryProps) {
  const cards = [
    { label: "Shifts worked", value: summary.shiftsWorked, tone: "" },
    { label: "Off", value: summary.offDays, tone: "" },
    { label: "Break", value: summary.breakDays, tone: "" },
    { label: "Present", value: summary.present, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Absent", value: summary.absent, tone: "text-destructive" },
    { label: "Sick", value: summary.sick, tone: "text-primary" },
    { label: "Leave", value: summary.leave, tone: "" },
    { label: "Not marked", value: summary.notMarked, tone: "text-muted-foreground" },
  ];

  return (
    <dl className="flex flex-wrap gap-2 md:gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex min-w-16 flex-col gap-0.5 rounded-lg border px-3 py-2 md:min-w-20 md:px-4 md:py-2.5"
        >
          <dt className="text-xs text-muted-foreground">{card.label}</dt>
          <dd className={cn("text-xl font-semibold tabular-nums", card.tone)}>{card.value}</dd>
        </div>
      ))}
    </dl>
  );
}
