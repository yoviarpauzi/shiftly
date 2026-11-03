import { CalendarX2Icon } from "lucide-react";
import type { AttendanceEmptyProps } from "@/types/attendance";

// A day with no confirmed roster for the location.
export function AttendanceEmpty({ locationName }: AttendanceEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border px-4 py-12 text-center">
      <CalendarX2Icon aria-hidden className="size-8 text-muted-foreground" />
      <p className="font-medium">No confirmed roster for this day</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Confirm the roster for {locationName} first, then come back to mark attendance.
      </p>
    </div>
  );
}
