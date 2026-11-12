import { BanIcon, CircleCheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkerProfileCardProps } from "@/types/worker-history";
import { Badge } from "@/components/ui/badge";

// Label above the value on a wide screen, side by side on a phone. Every field but the first gets a
// divider on its left from md up.
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 md:flex-col md:items-start md:justify-start md:gap-1 md:not-first:border-l md:not-first:pl-8">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-center justify-end gap-1.5 text-sm font-medium md:justify-start">
        {children}
      </dd>
    </div>
  );
}

export function WorkerProfileCard({ worker }: WorkerProfileCardProps) {
  const deleted = worker.deletedAt !== null;

  return (
    <dl className="flex flex-col gap-3 rounded-xl border px-4 py-4 md:flex-row md:items-center md:gap-8 md:px-5">
      <Field label="Positions">
        {worker.positions.length === 0 ? (
          <span className="font-normal text-muted-foreground">None</span>
        ) : (
          worker.positions.map((position) => (
            <Badge key={position.id} variant="secondary">
              {position.name}
            </Badge>
          ))
        )}
      </Field>
      <Field label="Contract end">{worker.endContract}</Field>
      <Field label="Work days">
        {worker.workDays} days a week
        {worker.workDaysPerWeek === null && (
          <span className="font-normal text-muted-foreground">from work rules</span>
        )}
      </Field>
      <Field label="Status">
        <Badge variant="outline" className="px-1.5 text-muted-foreground">
          {deleted ? (
            <BanIcon />
          ) : (
            <CircleCheckIcon className="fill-green-500 dark:fill-green-400" />
          )}
          {deleted ? "Deleted" : "Active"}
        </Badge>
      </Field>
    </dl>
  );
}
