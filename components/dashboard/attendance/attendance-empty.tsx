import { CalendarX2Icon } from "lucide-react";
import type { AttendanceEmptyProps } from "@/types/attendance";

// A day with no confirmed roster for the location, or for the locations in view.
export function AttendanceEmpty({ locationName }: AttendanceEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border px-4 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <CalendarX2Icon aria-hidden className="size-5 text-muted-foreground" />
      </span>
      <p className="font-medium">No confirmed roster for this day</p>
      <p className="text-sm text-muted-foreground">
        Confirm the roster for {locationName} first, then come back to mark attendance.
      </p>
    </div>
  );
}
