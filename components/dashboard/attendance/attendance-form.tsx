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

const LOCK_HINTS = {
  future: "Attendance for a future day can be viewed but not marked.",
  scope: "Choose a location to mark attendance.",
};

function toFormRows(rows: AttendanceFormProps["rows"]): AttendanceFormRow[] {
  return rows.map((row) => ({ ...row, draftStatus: row.status, draftReason: row.reason ?? "" }));
}

// The date row, the filters and summary the page passes in, and the table with its unsaved bar. The
// date row is always here, so a day with no roster still shows it. The form starts again from the
// saved rows when `resetKey` changes, after a save or when the day or scope changes. It does that
// in place, not with a React key, so the filters keep their focus while the rows change.
export function AttendanceForm({
  date,
  today,
  rows,
  resetKey,
  lock,
  locationView,
  filters,
  summary,
  empty,
}: AttendanceFormProps) {
  const readOnly = lock !== null;
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [errorIds, setErrorIds] = React.useState<ReadonlySet<string>>(NO_ERRORS);

  const form = useForm({
    defaultValues: { rows: toFormRows(rows) },
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

  const lastResetKey = React.useRef(resetKey);

  React.useEffect(() => {
    if (lastResetKey.current === resetKey) return;

    lastResetKey.current = resetKey;
    form.reset({ rows: toFormRows(rows) });
    setFormError(null);
    setErrorIds(NO_ERRORS);
  }, [form, resetKey, rows]);

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
          locationView,
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
          <div className="flex flex-col gap-4">
            <AttendanceDateRow
              date={date}
              today={today}
              canSave={!readOnly && changed.length > 0}
              canMarkAll={!readOnly && draftRows.some((row) => row.draftStatus === null)}
              onMarkAll={markAll}
              onSave={() => void form.handleSubmit()}
              isSaving={saving}
            />
            {filters}
            {summary}
            {lock && <p className="text-sm text-muted-foreground">{LOCK_HINTS[lock]}</p>}
            {draftRows.length === 0 ? (
              empty
            ) : (
              // Only the rows and the bar are in the form. The search box above is not, or Enter
              // in it would save.
              <form
                className="flex flex-col gap-4"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!readOnly) void form.handleSubmit();
                }}
              >
                <RowsView rows={draftRows} actions={actions} />
                {formError && (
                  <p role="alert" className="text-sm text-destructive">
                    {formError}
                  </p>
                )}
                {!readOnly && changed.length > 0 && (
                  <div className="sticky bottom-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/10 p-3 text-primary">
                    <span className="text-sm font-medium">
                      {changed.length} unsaved {changed.length === 1 ? "change" : "changes"}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="bg-background"
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
            )}
          </div>
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
  const { onStatusChange, onReasonChange, errorIds, changedIds, disabled, locationView } = actions;
  const columns = React.useMemo(
    () =>
      createAttendanceColumns({
        onStatusChange,
        onReasonChange,
        errorIds,
        changedIds,
        disabled,
        locationView,
      }),
    [onStatusChange, onReasonChange, errorIds, changedIds, disabled, locationView],
  );

  const table = useTable({
    features,
    data: rows,
    columns,
    getRowId: (row) => row.assignmentId,
    state: { columnVisibility: { location: locationView !== "none" } },
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
