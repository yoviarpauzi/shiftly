"use client";

import { useForm } from "@tanstack/react-form";
import { useTable } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { commitWorkerImport, previewWorkerImport } from "@/app/dashboard/workers/import-actions";
import type { ImportPreview, ImportWorkersDialogProps } from "@/types/worker-import";
import { checkImportFileMeta, IMPORT_MAX_ROWS } from "@/validation/worker-import";
import { createImportColumns, importFeatures } from "@/components/dashboard/workers/import-columns";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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

const TEMPLATE_URL = "/dashboard/workers/import/template";

const UNEXPECTED_ERROR_MESSAGE = "Something went wrong. Try again.";

function summaryText({ summary }: ImportPreview) {
  const errors = `${summary.error} ${summary.error === 1 ? "error" : "errors"}`;

  return `${summary.create} create, ${summary.update} update, ${errors}`;
}

function fileFormData(file: File) {
  const body = new FormData();

  body.set("file", file);

  return body;
}

export function ImportWorkersDialog({ open, onOpenChange }: ImportWorkersDialogProps) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const columns = useMemo(() => createImportColumns(), []);

  const table = useTable({
    features: importFeatures,
    data: preview?.rows ?? [],
    columns,
    getRowId: (row) => `${row.rowNumber}`,
  });

  const form = useForm({
    defaultValues: { file: null as File | null },
    onSubmit: async ({ value }) => {
      if (!value.file || !preview || preview.summary.error > 0) {
        return;
      }

      setFormError(null);
      setIsSaving(true);

      try {
        const result = await commitWorkerImport(fileFormData(value.file));

        if (!result.ok) {
          setFormError(result.formError ?? null);

          if (result.preview) {
            setPreview(result.preview);
          }

          return;
        }

        toast.success(`${result.created} created, ${result.updated} updated`);
        onOpenChange(false);
      } catch {
        setFormError(UNEXPECTED_ERROR_MESSAGE);
      } finally {
        setIsSaving(false);
      }
    },
  });

  // The file is checked as soon as it is chosen, so the person sees every problem before saving.
  async function chooseFile(file: File | null) {
    setPreview(null);
    setFormError(null);

    if (!file || checkImportFileMeta(file)) {
      return;
    }

    setIsChecking(true);

    try {
      const result = await previewWorkerImport(fileFormData(file));

      if (result.ok) {
        setPreview({ rows: result.rows, summary: result.summary });
      } else {
        setFormError(result.formError);
      }
    } catch {
      setFormError(UNEXPECTED_ERROR_MESSAGE);
    } finally {
      setIsChecking(false);
    }
  }

  const isBusy = isChecking || isSaving;
  const canImport = preview !== null && preview.rows.length > 0 && preview.summary.error === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isBusy) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>Import workers</DialogTitle>
            <DialogDescription>
              Upload an .xlsx file with the columns employee_id, name, site, location, and positions
              (separated by commas). Up to {IMPORT_MAX_ROWS} rows and 1 MB. An employee ID that is
              already used updates that worker and replaces its positions. Type employee IDs as text so
              leading zeros stay.
            </DialogDescription>
            <a
              href={TEMPLATE_URL}
              download
              className={cn(buttonVariants({ variant: "link", size: "sm" }), "w-fit px-0")}
            >
              Download template
            </a>
          </DialogHeader>
          <FieldGroup>
            <form.Field name="file">
              {(field) => {
                const fileError = field.state.value ? checkImportFileMeta(field.state.value) : null;

                return (
                  <Field data-invalid={fileError !== null || undefined}>
                    <FieldLabel htmlFor={field.name}>File</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      type="file"
                      accept=".xlsx"
                      disabled={isBusy}
                      aria-invalid={fileError !== null || undefined}
                      // Picking the same path again fires no change event, so a fixed file would keep its old
                      // preview. Clearing the value first makes every pick a change.
                      onClick={(event) => {
                        event.currentTarget.value = "";
                      }}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;

                        field.handleChange(file);
                        void chooseFile(file);
                      }}
                    />
                    {fileError && <FieldError>{fileError}</FieldError>}
                    {isChecking && (
                      <FieldDescription className="flex items-center gap-2">
                        <Spinner />
                        Checking the file
                      </FieldDescription>
                    )}
                  </Field>
                );
              }}
            </form.Field>
          </FieldGroup>
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          {preview && (
            <div className="flex flex-col gap-2">
              <p aria-live="polite" className="text-sm font-medium">
                {summaryText(preview)}
              </p>
              <div className="max-h-72 overflow-y-auto rounded-lg border">
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
                        className={row.original.action === "error" ? "bg-destructive/5" : undefined}
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
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={isBusy} />}>Cancel</DialogClose>
            <Button type="submit" disabled={!canImport || isBusy}>
              {isSaving && <Spinner data-icon="inline-start" />}
              Import
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
