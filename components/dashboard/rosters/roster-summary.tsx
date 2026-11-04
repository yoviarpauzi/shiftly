import type { RosterSummaryProps } from "@/types/rosters";
import { cn } from "@/lib/utils";

// Four counts over the roster. Conflicts turn red when there are any.
export function RosterSummary({ counts }: RosterSummaryProps) {
  const stats = [
    { label: "Workers", value: counts.workers, danger: false },
    { label: "Shifts assigned", value: counts.shiftsAssigned, danger: false },
    { label: "Conflicts", value: counts.conflicts, danger: counts.conflicts > 0 },
    { label: "Manual edits", value: counts.edits, danger: false },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1 rounded-lg border p-4">
          <dt className="text-sm text-muted-foreground">{stat.label}</dt>
          <dd
            className={cn(
              "text-2xl font-semibold tabular-nums",
              stat.danger && "text-destructive",
            )}
          >
            {stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
