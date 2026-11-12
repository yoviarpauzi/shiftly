"use client";

import * as React from "react";
import { PencilIcon } from "lucide-react";
import type { EditWorkerButtonProps } from "@/types/worker-history";
import { WorkerFormDialog } from "@/components/dashboard/workers/worker-form-dialog";
import { Button } from "@/components/ui/button";

export function EditWorkerButton({ worker, options }: EditWorkerButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);

  // A new key remounts the dialog, so each open starts from the worker's current values.
  function openForm() {
    setFormKey((key) => key + 1);
    setOpen(true);
  }

  return (
    <>
      <Button variant="outline" onClick={openForm}>
        <PencilIcon data-icon="inline-start" />
        Edit
      </Button>
      <WorkerFormDialog
        key={formKey}
        worker={worker}
        options={options}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
