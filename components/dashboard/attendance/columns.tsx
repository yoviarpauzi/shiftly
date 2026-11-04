import {
  columnVisibilityFeature,
  createColumnHelper,
  tableFeatures,
} from "@tanstack/react-table";
import { REASON_MAX_LENGTH } from "@/validation/attendance";
import type { AttendanceFormRow, AttendanceRowActions } from "@/types/attendance";
import { StatusSelect } from "@/components/dashboard/attendance/attendance-status";
import { ShiftChip } from "@/components/dashboard/shift-chip";
import { Input } from "@/components/ui/input";

export const features = tableFeatures({
  columnVisibilityFeature,
});

const columnHelper = createColumnHelper<typeof features, AttendanceFormRow>();

export function createAttendanceColumns({
  onStatusChange,
  onReasonChange,
  errorIds,
  disabled,
}: AttendanceRowActions) {
  return columnHelper.columns([
    columnHelper.accessor("employeeId", {
      header: () => <span>Employee ID</span>,
      cell: ({ row }) => <span className="tabular-nums">{row.original.employeeId}</span>,
    }),
    columnHelper.accessor("workerName", {
      header: () => <span>Name</span>,
      cell: ({ row }) => <span className="font-medium">{row.original.workerName}</span>,
    }),
    columnHelper.accessor("departmentName", {
      header: () => <span>Department</span>,
      cell: ({ row }) => row.original.departmentName,
    }),
    columnHelper.accessor("positionName", {
      header: () => <span>Position</span>,
      cell: ({ row }) => row.original.positionName,
    }),
    columnHelper.accessor("shiftOrder", {
      header: () => <span>Shift</span>,
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <ShiftChip order={row.original.shiftOrder} />
          <span className="text-muted-foreground tabular-nums">
            {row.original.startTime} - {row.original.endTime}
          </span>
        </span>
      ),
    }),
    columnHelper.display({
      id: "status",
      header: () => <span>Status</span>,
      cell: ({ row }) => (
        <StatusSelect
          value={row.original.draftStatus}
          onChange={(status) => onStatusChange(row.original.assignmentId, status)}
          label={`Status of ${row.original.workerName}`}
          disabled={disabled}
          invalid={errorIds.has(row.original.assignmentId)}
        />
      ),
      enableHiding: false,
    }),
    columnHelper.display({
      id: "reason",
      header: () => <span>Reason</span>,
      cell: ({ row }) => (
        <Input
          value={row.original.draftReason}
          onChange={(event) => onReasonChange(row.original.assignmentId, event.target.value)}
          placeholder={
            row.original.draftStatus === null ? "Mark a status first" : "Add a reason (optional)"
          }
          maxLength={REASON_MAX_LENGTH}
          disabled={disabled || row.original.draftStatus === null}
          aria-label={`Reason for ${row.original.workerName}`}
          className="h-9 min-w-56"
        />
      ),
      enableHiding: false,
    }),
  ]);
}
