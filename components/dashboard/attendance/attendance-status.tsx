import { ATTENDANCE_STATUS_LABELS } from "@/app/dashboard/attendance/attendance-rules";
import type { AttendanceStatus } from "@/types/attendance";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const NOT_MARKED = "not-marked";

const DOT_COLOURS: Record<AttendanceStatus | typeof NOT_MARKED, string> = {
  present: "bg-emerald-500",
  absent: "bg-red-500",
  sick: "bg-amber-500",
  leave: "bg-sky-500",
  [NOT_MARKED]: "bg-muted-foreground/40",
};

export const STATUS_ORDER: (AttendanceStatus | typeof NOT_MARKED)[] = [
  NOT_MARKED,
  "present",
  "absent",
  "sick",
  "leave",
];

// A coloured dot beside the label, so a status is never told by colour alone.
export function StatusLabel({ status }: { status: AttendanceStatus | null }) {
  const key = status ?? NOT_MARKED;

  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className={cn("size-2 rounded-full", DOT_COLOURS[key])} />
      {ATTENDANCE_STATUS_LABELS[key]}
    </span>
  );
}

type StatusSelectProps = {
  value: AttendanceStatus | null;
  onChange: (status: AttendanceStatus | null) => void;
  label: string;
  disabled: boolean;
  invalid: boolean;
};

export function StatusSelect({ value, onChange, label, disabled, invalid }: StatusSelectProps) {
  const options = STATUS_ORDER.map((status) => ({
    value: status,
    label: ATTENDANCE_STATUS_LABELS[status],
  }));

  return (
    <Select
      value={value ?? NOT_MARKED}
      onValueChange={(next) => {
        if (next) {
          onChange(next === NOT_MARKED ? null : (next as AttendanceStatus));
        }
      }}
      items={options}
      disabled={disabled}
    >
      <SelectTrigger aria-label={label} aria-invalid={invalid} className="h-9 w-36">
        <SelectValue>
          <StatusLabel status={value} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {STATUS_ORDER.map((status) => (
            <SelectItem key={status} value={status}>
              <StatusLabel status={status === NOT_MARKED ? null : status} />
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
