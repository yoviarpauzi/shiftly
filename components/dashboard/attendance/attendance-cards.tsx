import {
  ATTENDANCE_STATUS_LABELS,
  rowLocationLabel,
} from "@/app/dashboard/attendance/attendance-rules";
import { REASON_MAX_LENGTH } from "@/validation/attendance";
import type { AttendanceCardsProps, AttendanceStatus } from "@/types/attendance";
import { ShiftChip } from "@/components/dashboard/shift-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STATUSES: AttendanceStatus[] = ["present", "absent", "sick", "leave"];

// The same rows as the table, as cards, for widths under md. A status button that is already chosen
// sets the worker back to Not marked.
export function AttendanceCards({
  rows,
  onStatusChange,
  onReasonChange,
  errorIds,
  changedIds,
  disabled,
  locationView,
}: AttendanceCardsProps) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li
          key={row.assignmentId}
          className={cn(
            "flex flex-col gap-3 rounded-lg border p-4",
            changedIds.has(row.assignmentId) && "bg-primary/5",
            errorIds.has(row.assignmentId) && "border-destructive",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">{row.workerName}</span>
              <span className="text-sm text-muted-foreground">
                {[row.employeeId, rowLocationLabel(row, locationView), row.departmentName, row.positionName]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground tabular-nums">
              <ShiftChip order={row.shiftOrder} />
              {row.startTime} - {row.endTime}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label={`Status of ${row.workerName}`}>
            {STATUSES.map((status) => (
              <Button
                key={status}
                type="button"
                variant={row.draftStatus === status ? "default" : "outline"}
                aria-pressed={row.draftStatus === status}
                disabled={disabled}
                onClick={() =>
                  onStatusChange(row.assignmentId, row.draftStatus === status ? null : status)
                }
              >
                {ATTENDANCE_STATUS_LABELS[status]}
              </Button>
            ))}
          </div>
          <Input
            value={row.draftReason}
            onChange={(event) => onReasonChange(row.assignmentId, event.target.value)}
            placeholder={row.draftStatus === null ? "Mark a status first" : "Add a reason (optional)"}
            maxLength={REASON_MAX_LENGTH}
            disabled={disabled || row.draftStatus === null}
            aria-label={`Reason for ${row.workerName}`}
          />
        </li>
      ))}
    </ul>
  );
}
