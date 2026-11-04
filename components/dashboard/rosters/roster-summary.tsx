import type { RosterSummaryProps } from "@/types/rosters";
import { cn } from "@/lib/utils";

// Five counts over the roster. Conflicts turn red and Warnings amber when there are any.
export function RosterSummary({ counts }: RosterSummaryProps) {
  const stats = [
    { label: "Workers", value: counts.workers, tone: null },
    { label: "Shifts assigned", value: counts.shiftsAssigned, tone: null },
    { label: "Conflicts", value: counts.conflicts, tone: counts.conflicts > 0 ? "danger" : null },
    { label: "Warnings", value: counts.warnings, tone: counts.warnings > 0 ? "warning" : null },
    { label: "Manual edits", value: counts.edits, tone: null },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1 rounded-lg border p-4">
          <dt className="text-sm text-muted-foreground">{stat.label}</dt>
          <dd
            className={cn(
              "text-2xl font-semibold tabular-nums",
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
