import type { RosterSummaryProps } from "@/types/rosters";
import { cn } from "@/lib/utils";

// Five counts over the roster, as compact tiles. Conflicts turn red and Warnings amber when there
// are any.
export function RosterSummary({ counts }: RosterSummaryProps) {
  const stats = [
    { label: "Workers", value: counts.workers, tone: null },
    { label: "Shifts assigned", value: counts.shiftsAssigned, tone: null },
    { label: "Conflicts", value: counts.conflicts, tone: counts.conflicts > 0 ? "danger" : null },
    { label: "Warnings", value: counts.warnings, tone: counts.warnings > 0 ? "warning" : null },
    { label: "Manual edits", value: counts.edits, tone: null },
  ];

  return (
    <dl className="flex flex-wrap gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex min-w-20 flex-col gap-0.5 rounded-lg border px-4 py-2.5"
        >
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd
            className={cn(
              "text-xl font-semibold tabular-nums",
              stat.tone === "danger" && "text-destructive",
              stat.tone === "warning" && "text-amber-700 dark:text-amber-400",
            )}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
