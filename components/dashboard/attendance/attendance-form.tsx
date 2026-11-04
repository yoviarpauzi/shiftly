"use client";

import { useForm } from "@tanstack/react-form";
import { useTable } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { saveAttendance } from "@/app/dashboard/attendance/actions";
import { changedEntries, markAllPresent } from "@/app/dashboard/attendance/attendance-rules";
import type {
  AttendanceFormProps,
  AttendanceFormRow,
  AttendanceStatus,
} from "@/types/attendance";
import { AttendanceCards } from "@/components/dashboard/attendance/attendance-cards";
import { AttendanceDateRow } from "@/components/dashboard/attendance/attendance-date-row";
import {
  createAttendanceColumns,
  features,
} from "@/components/dashboard/attendance/columns";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const NO_ERRORS: ReadonlySet<string> = new Set();

// The form is keyed by the saved rows, so it starts again from them after a save.
export function AttendanceForm({ date, today, rows, readOnly }: AttendanceFormProps) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [errorIds, setErrorIds] = React.useState<ReadonlySet<string>>(NO_ERRORS);

  const form = useForm({
    defaultValues: {
      rows: rows.map(
        (row): AttendanceFormRow => ({ ...row, draftStatus: row.status, draftReason: row.reason ?? "" }),
      ),
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      setErrorIds(NO_ERRORS);

      const entries = changedEntries(value.rows);

      if (entries.length === 0) {
        return;
      }

      const result = await saveAttendance({ date, entries });

      if (!result.ok) {
        setFormError(result.formError);
        setErrorIds(
          new Set(
            Object.keys(result.entryErrors ?? {}).map((index) => entries[Number(index)].assignmentId),
          ),
        );
        return;
      }

      toast.success("Attendance saved");
      router.refresh();
    },
  });

  const update = React.useCallback(
    (assignmentId: string, patch: (row: AttendanceFormRow) => AttendanceFormRow) => {
      form.setFieldValue("rows", (current) =>
        current.map((row) => (row.assignmentId === assignmentId ? patch(row) : row)),
      );
      setErrorIds((current) => {
        if (!current.has(assignmentId)) return current;

        const next = new Set(current);

        next.delete(assignmentId);

        return next;
      });
    },
    [form],
  );

  return (
    <form.Subscribe
      selector={(state) => ({ rows: state.values.rows, saving: state.isSubmitting })}
    >
      {({ rows: draftRows, saving }) => {
        const changed = changedEntries(draftRows);
        const changedIds = new Set(changed.map((entry) => entry.assignmentId));
        const disabled = readOnly || saving;

        const actions = {
          onStatusChange: (assignmentId: string, status: AttendanceStatus | null) =>
            update(assignmentId, (row) => ({
              ...row,
              draftStatus: status,
              // A worker set back to Not marked has no reason to keep.
              draftReason: status === null ? "" : row.draftReason,
            })),
          onReasonChange: (assignmentId: string, reason: string) =>
            update(assignmentId, (row) => ({ ...row, draftReason: reason })),
          errorIds,
          changedIds,
          disabled,
        };

        function markAll() {
          const filled = markAllPresent(
            draftRows.map((row) => ({
              assignmentId: row.assignmentId,
              status: row.draftStatus,
              reason: row.draftReason || null,
            })),
          );

          form.setFieldValue(
            "rows",
            draftRows.map((row, index) => ({ ...row, draftStatus: filled[index].status })),
          );
        }

        return (
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!readOnly) void form.handleSubmit();
            }}
          >
            <AttendanceDateRow
              date={date}
              today={today}
              canSave={!readOnly && changed.length > 0}
              canMarkAll={!readOnly && draftRows.some((row) => row.draftStatus === null)}
              onMarkAll={markAll}
              onSave={() => void form.handleSubmit()}
              isSaving={saving}
            />
            {readOnly && (
              <p className="text-sm text-muted-foreground">
                Attendance for a future day can be viewed but not marked.
              </p>
            )}
            <RowsView rows={draftRows} actions={actions} />
            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            {!readOnly && changed.length > 0 && (
              <div className="sticky bottom-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3 shadow-sm">
                <span className="text-sm font-medium">
                  {changed.length} unsaved {changed.length === 1 ? "change" : "changes"}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => {
                      form.reset();
                      setFormError(null);
                      setErrorIds(NO_ERRORS);
                    }}
                  >
                    Discard
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Spinner data-icon="inline-start" />}
                    Save attendance
                  </Button>
                </div>
              </div>
            )}
          </form>
        );
      }}
    </form.Subscribe>
  );
}

type RowsViewProps = {
  rows: AttendanceFormRow[];
  actions: Parameters<typeof createAttendanceColumns>[0];
};

// The table from md up and the cards below it, both bound to the same rows.
function RowsView({ rows, actions }: RowsViewProps) {
  const { onStatusChange, onReasonChange, errorIds, changedIds, disabled } = actions;
  const columns = React.useMemo(
    () =>
      createAttendanceColumns({ onStatusChange, onReasonChange, errorIds, changedIds, disabled }),
    [onStatusChange, onReasonChange, errorIds, changedIds, disabled],
  );

  const table = useTable({
    features,
    data: rows,
    columns,
    getRowId: (row) => row.assignmentId,
  });

  return (
    <>
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  changedIds.has(row.id) && "bg-primary/5",
                  errorIds.has(row.id) && "bg-destructive/5",
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="md:hidden">
        <AttendanceCards rows={rows} {...actions} />
      </div>
    </>
  );
}
