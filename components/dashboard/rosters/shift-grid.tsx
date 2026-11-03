import { shortDate, targetsTotalMessage } from "@/app/dashboard/rosters/roster-rules";
import type { ShiftGridProps } from "@/types/rosters";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// One line's split: a row per shift, a column per day, and a total row that shows whether each day
// adds up to what the request needs.
export function ShiftGrid({ line, days, shifts, invalidDay, disabled, onChange }: ShiftGridProps) {
  const sums = days.map((_, day) =>
    (line.split[day] ?? []).reduce((total, count) => total + count, 0),
  );

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-base font-medium">{line.title}</h2>
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
            {shifts.map((shift, shiftIndex) => (
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
                      disabled={disabled}
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
