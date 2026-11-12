import Link from "next/link";
import { ATTENDANCE_STATUS_LABELS } from "@/app/dashboard/attendance/attendance-rules";
import { historyHref } from "@/app/dashboard/workers/worker-history-rules";
import type { WorkerFilterOption } from "@/types/workers";
import type { HistoryFiltersProps } from "@/types/worker-history";
import { WorkersSelectFilter } from "@/components/dashboard/workers/workers-select-filter";
import { Button } from "@/components/ui/button";

const TYPE_OPTIONS: WorkerFilterOption[] = [
  { value: "all", label: "All types" },
  { value: "work", label: "Work" },
  { value: "off", label: "Off" },
  { value: "break", label: "Break" },
];

const ATTENDANCE_OPTIONS: WorkerFilterOption[] = [
  { value: "all", label: "All attendance" },
  { value: "present", label: ATTENDANCE_STATUS_LABELS.present },
  { value: "absent", label: ATTENDANCE_STATUS_LABELS.absent },
  { value: "sick", label: ATTENDANCE_STATUS_LABELS.sick },
  { value: "leave", label: ATTENDANCE_STATUS_LABELS.leave },
  { value: "not-marked", label: ATTENDANCE_STATUS_LABELS["not-marked"] },
];

// Department, shift, type, and attendance. The department and shift choices are the ones the month
// uses. Every change goes to the URL and drops the page, like the other filters. Clear filters only
// shows while one is set, and keeps the month and the sort.
export function HistoryFilters({ workerId, params, filters, choices }: HistoryFiltersProps) {
  const active =
    filters.departmentId !== null ||
    filters.shiftId !== null ||
    filters.type !== "all" ||
    filters.attendance !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <WorkersSelectFilter
        param="department"
        value={filters.departmentId ?? "all"}
        options={[
          { value: "all", label: "All departments" },
          ...choices.departments.map((entry) => ({ value: entry.id, label: entry.name })),
        ]}
        ariaLabel="Filter days by department"
        className="h-9 w-44"
      />
      <WorkersSelectFilter
        param="shift"
        value={filters.shiftId ?? "all"}
        options={[
          { value: "all", label: "All shifts" },
          ...choices.shifts.map((entry) => ({
            value: entry.id,
            label: `S${entry.order} · ${entry.name}`,
          })),
        ]}
        ariaLabel="Filter days by shift"
        className="h-9 w-36"
      />
      <WorkersSelectFilter
        param="type"
        value={filters.type}
        options={TYPE_OPTIONS}
        ariaLabel="Filter days by type"
        className="h-9 w-32"
      />
      <WorkersSelectFilter
        param="attendance"
        value={filters.attendance}
        options={ATTENDANCE_OPTIONS}
        ariaLabel="Filter days by attendance"
        className="h-9 w-40"
      />
      {active ? (
        <Button
          variant="ghost"
          className="text-primary"
          render={
            <Link
              href={historyHref(workerId, params, {
                department: null,
                shift: null,
                type: null,
                attendance: null,
              })}
            />
          }
          nativeButton={false}
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
