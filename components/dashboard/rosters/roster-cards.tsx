import type { RosterRow } from "@/types/rosters";
import { formatRequestDates } from "@/app/dashboard/requests/request-rules";
import { formatRosterTime } from "@/app/dashboard/rosters/roster-rules";
import { ConflictCount, RosterRowAction } from "@/components/dashboard/rosters/roster-row-parts";
import { RosterStatusBadge } from "@/components/dashboard/rosters/roster-status-badge";

// The same rows as the table, as cards, for widths under md.
export function RosterCards({ rows, empty }: { rows: RosterRow[]; empty: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">{empty}</div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.requestId} className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium tabular-nums">{row.poNumber}</span>
              <span className="text-sm text-muted-foreground">
                {row.type === "weekly" ? "Weekly" : "Daily"} · {row.locationName}
              </span>
            </div>
            <RosterStatusBadge status={row.status} />
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Dates</dt>
            <dd className="text-right tabular-nums">{formatRequestDates(row.type, row.startDate)}</dd>
            <dt className="text-muted-foreground">Conflicts</dt>
            <dd className="text-right">
              <ConflictCount count={row.conflictCount} />
            </dd>
            <dt className="text-muted-foreground">Updated</dt>
            <dd className="text-right tabular-nums">
              {row.updatedAt ? formatRosterTime(row.updatedAt) : "—"}
            </dd>
          </dl>
          <div className="flex justify-end">
            <RosterRowAction row={row} />
          </div>
        </li>
      ))}
    </ul>
  );
}
