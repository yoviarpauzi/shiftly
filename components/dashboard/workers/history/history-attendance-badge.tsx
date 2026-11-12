import { ATTENDANCE_STATUS_LABELS } from "@/app/dashboard/attendance/attendance-rules";
import type { HistoryAttendanceBadgeProps } from "@/types/worker-history";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DOT_TONES = {
  present: "bg-emerald-500",
  absent: "bg-destructive",
  sick: "bg-primary",
  leave: "bg-muted-foreground",
  "not-marked": "border border-muted-foreground",
} as const;

// A dot and the label. Off and break days have no attendance, so they show a dash. Not marked has
// a hollow dot: nothing has been recorded.
export function HistoryAttendanceBadge({ attendance }: HistoryAttendanceBadgeProps) {
  if (attendance === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <Badge variant="outline" className="px-1.5 text-muted-foreground">
      <span aria-hidden className={cn("size-2 rounded-full", DOT_TONES[attendance])} />
      {ATTENDANCE_STATUS_LABELS[attendance]}
    </Badge>
  );
}
