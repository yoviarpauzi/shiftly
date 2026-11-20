import { canReplace, substituteLabel } from "@/app/dashboard/attendance/attendance-rules";
import type { ReplaceControlProps } from "@/types/attendance";
import { Button } from "@/components/ui/button";

// Nothing for a row that is not a saved Absent one. The name of who covers a row stays visible on a
// locked day, but the buttons do not.
export function ReplaceControl({ row, disabled, onReplace }: ReplaceControlProps) {
  const offered = canReplace(row, disabled);

  if (row.substitute === null) {
    return offered ? (
      <Button type="button" variant="outline" size="sm" onClick={() => onReplace(row)}>
        Replace
      </Button>
    ) : null;
  }

  return (
    <span className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
      {substituteLabel(row.substitute)}
      {offered && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onReplace(row)}
        >
          Change
        </Button>
      )}
    </span>
  );
}
