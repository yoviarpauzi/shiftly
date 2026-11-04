import type { RosterSummaryProps } from "@/types/rosters";
import { cn } from "@/lib/utils";

// Five counts over the roster, in one line. Conflicts turn red and Warnings amber when there are any.
export function RosterSummary({ counts }: RosterSummaryProps) {
  const stats = [
    { label: "Workers", value: counts.workers, tone: null },
    { label: "Shifts assigned", value: counts.shiftsAssigned, tone: null },
    { label: "Conflicts", value: counts.conflicts, tone: counts.conflicts > 0 ? "danger" : null },
    { label: "Warnings", value: counts.warnings, tone: counts.warnings > 0 ? "warning" : null },
    { label: "Manual edits", value: counts.edits, tone: null },
  ];

  return (
    <dl className="flex flex-wrap gap-x-5 gap-y-2 border-y py-3 sm:gap-x-8">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-row-reverse items-baseline justify-end gap-2">
          <dd
            className={cn(
              "text-xl font-semibold tabular-nums",
              stat.tone === "danger" && "text-destructive",
              stat.tone === "warning" && "text-amber-700 dark:text-amber-400",
            )}
          >
            {stat.value}
          </dd>
          <dt className="text-sm text-muted-foreground">{stat.label}</dt>
        </div>
      ))}
    </dl>
  );
}
