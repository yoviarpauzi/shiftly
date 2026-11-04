import { shortDate, warningsLabel } from "@/app/dashboard/rosters/roster-rules";
import type { WarningsPanelProps } from "@/types/rosters";
import { Badge } from "@/components/ui/badge";

// Every rule the roster breaks as it stands. A warning never blocks an edit or the confirmation.
// Like the Conflicts panel, it shows nothing when nothing is broken.
export function WarningsPanel({ warnings }: WarningsPanelProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="roster-warnings-title"
      className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"
    >
      <div className="flex items-center gap-2">
        <h2 id="roster-warnings-title" className="text-base font-medium">
          Warnings
        </h2>
        <Badge
          variant="secondary"
          aria-label={warningsLabel(warnings.length)}
          className="bg-amber-500/15 text-amber-800 dark:text-amber-300"
        >
          {warnings.length}
        </Badge>
      </div>
      <ul className="flex flex-col gap-3">
        {warnings.map((warning, index) => (
          <li key={index} className="flex flex-col gap-0.5 text-sm">
            <span className="font-medium">
              {warning.workerName ? `${warning.workerName} · ` : ""}
              {shortDate(warning.date)}
            </span>
            <span className="text-muted-foreground">{warning.lineTitle}</span>
            <span>{warning.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
