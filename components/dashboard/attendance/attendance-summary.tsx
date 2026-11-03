import type { AttendanceSummaryProps } from "@/types/attendance";
import { cn } from "@/lib/utils";

// Six counts for the day. They ignore the table's filters, so they do not move when one changes.
export function AttendanceSummary({ summary }: AttendanceSummaryProps) {
  const cards = [
    { label: "Scheduled", value: summary.scheduled, tone: "" },
    { label: "Present", value: summary.present, tone: "text-emerald-700 dark:text-emerald-400" },
    { label: "Absent", value: summary.absent, tone: "text-destructive" },
    { label: "Sick", value: summary.sick, tone: "text-amber-700 dark:text-amber-400" },
    { label: "Leave", value: summary.leave, tone: "" },
    { label: "Not marked", value: summary.notMarked, tone: "text-muted-foreground" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <div key={card.label} className="flex flex-col gap-1 rounded-lg border p-3">
          <dt className="text-sm text-muted-foreground">{card.label}</dt>
          <dd className={cn("text-2xl font-semibold tabular-nums", card.tone)}>{card.value}</dd>
        </div>
      ))}
    </dl>
  );
}
