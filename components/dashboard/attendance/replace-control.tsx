import { useId } from "react";
import {
  canReplace,
  replaceHint,
  substituteLabel,
} from "@/app/dashboard/attendance/attendance-rules";
import type { ReplaceControlProps } from "@/types/attendance";
import { Button } from "@/components/ui/button";

// Nothing for a row that is not a saved Absent one. The name of who covers a row stays visible on a
// locked day, but the buttons do not. While other rows have unsaved changes the button stays but is
// off, with a visible hint, because a replacement refreshes the page and would drop those changes.
export function ReplaceControl({
  row,
  disabled,
  replaceDisabled,
  hasUnsavedChanges,
  onReplace,
}: ReplaceControlProps) {
  const hintId = useId();
  const offered = canReplace(row, replaceDisabled);
  const hint = replaceHint(row, { disabled, hasUnsavedChanges });
  const shown = offered || hint !== null;
  const hintText = hint && (
    <span id={hintId} className="text-xs text-muted-foreground">
      {hint}
    </span>
  );

  if (row.substitute === null) {
    return shown ? (
      <span className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!offered}
          aria-describedby={hint ? hintId : undefined}
          onClick={() => onReplace(row)}
        >
          Replace
        </Button>
        {hintText}
      </span>
    ) : null;
  }

  return (
    <span className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
      {substituteLabel(row.substitute)}
      {shown && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!offered}
          aria-describedby={hint ? hintId : undefined}
          onClick={() => onReplace(row)}
        >
          Change
        </Button>
      )}
      {hintText}
    </span>
  );
}
