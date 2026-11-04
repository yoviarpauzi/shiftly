"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { formatAttendanceDate } from "@/app/dashboard/attendance/attendance-rules";
import type { AttendanceDateButtonProps } from "@/types/attendance";
import { isCalendarDate } from "@/validation/calendar-date";
import { Button } from "@/components/ui/button";

// The day as a button with a calendar icon. A click opens the browser's date picker, which lives in
// a visually hidden date input, so the page keeps one native control and no calendar component.
export function AttendanceDateButton({ date, onPick }: AttendanceDateButtonProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const label = formatAttendanceDate(date);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        aria-label={`Date, ${label}`}
        onClick={() => inputRef.current?.showPicker?.()}
      >
        <CalendarIcon data-icon="inline-start" />
        {label}
      </Button>
      <input
        ref={inputRef}
        type="date"
        value={date}
        onChange={(event) => {
          // The picker sends an empty value while a date is half typed, and a year with more than
          // four digits, which the page would read as no date at all.
          if (isCalendarDate(event.target.value)) {
            onPick(event.target.value);
          }
        }}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
      />
    </>
  );
}
