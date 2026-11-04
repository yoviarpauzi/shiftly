import { shortDate, targetsTotalMessage } from "@/app/dashboard/rosters/roster-rules";
import type { ShiftGridProps } from "@/types/rosters";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// One line's split: a row per shift, a column per day, and a total row that shows whether each day
// adds up to what the request needs. A line the request fixed to a shift shows only that shift's
// row, locked to the request's numbers.
export function ShiftGrid({ line, days, shifts, invalidDay, disabled, onChange }: ShiftGridProps) {
  const sums = days.map((_, day) =>
    (line.split[day] ?? []).reduce((total, count) => total + count, 0),
  );
  const fixed = line.fixedShiftId !== null;
  // Each row keeps its index in the full list, because the split is indexed by it.
  const rows = shifts
    .map((shift, shiftIndex) => ({ shift, shiftIndex }))
    .filter(({ shift }) => !fixed || shift.id === line.fixedShiftId);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-base font-medium">
          {line.title} · {line.shiftLabel}
        </h2>
        <p className="text-sm text-muted-foreground">
          {fixed
            ? "Shift and headcount are set in the request"
            : "Headcount per day comes from the request"}
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Shift
              </th>
              {days.map((date) => (
                <th key={date} scope="col" className="px-2 py-2 text-center font-medium tabular-nums">
                  {shortDate(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ shift, shiftIndex }) => (
              <tr key={shift.id} className="border-t">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  <span className="font-medium">{shift.name}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {shift.startTime} - {shift.endTime}
                  </span>
                </th>
                {days.map((date, day) => (
                  <td key={date} className="px-2 py-1.5 text-center">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={999}
                      value={line.split[day]?.[shiftIndex] ?? 0}
                      onChange={(event) => {
                        const parsed = Math.trunc(Number(event.target.value));

                        onChange(day, shiftIndex, Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
                      }}
                      disabled={disabled || fixed}
                      aria-invalid={invalidDay === day}
                      aria-label={`${shift.name}, ${shortDate(date)}`}
                      className="h-9 w-16 text-center tabular-nums"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/50">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                Total / required
              </th>
              {days.map((date, day) => {
                const matches = sums[day] === line.required[day];

                return (
                  <td
                    key={date}
                    className={cn(
                      "px-2 py-2 text-center font-medium tabular-nums",
                      matches
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-destructive",
                    )}
                  >
                    {sums[day]} / {line.required[day] ?? 0}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      {invalidDay !== null && (
        <p role="alert" className="text-sm text-destructive">
          {targetsTotalMessage(days[invalidDay], sums[invalidDay], line.required[invalidDay] ?? 0)}
        </p>
      )}
    </div>
  );
}
