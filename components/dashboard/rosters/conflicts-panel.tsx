import { shortDate } from "@/app/dashboard/rosters/roster-rules";
import type { ConflictsPanelProps } from "@/types/rosters";

// Every shift the rules could not fill, with the reason the engine recorded.
export function ConflictsPanel({ conflicts }: ConflictsPanelProps) {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <h2 className="text-base font-medium text-destructive">
        {conflicts.length} {conflicts.length === 1 ? "conflict" : "conflicts"}
      </h2>
      <ul className="flex flex-col gap-3">
        {conflicts.map((conflict, index) => (
          <li key={index} className="flex flex-col gap-0.5 text-sm">
            <span className="font-medium">
              {shortDate(conflict.date)}
              {conflict.shiftOrder !== null && ` · Shift ${conflict.shiftOrder}`} · short by{" "}
              {conflict.shortfall}
            </span>
            <span className="text-muted-foreground">{conflict.lineTitle}</span>
            <span>{conflict.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
