"use client";

import * as React from "react";
import { PencilIcon } from "lucide-react";
import type { EditDepartmentButtonProps } from "@/types/departments";
import { DepartmentFormDialog } from "@/components/dashboard/departments/department-form-dialog";
import { Button } from "@/components/ui/button";

export function EditDepartmentButton({ department, locationChoice }: EditDepartmentButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);

  // A new key remounts the dialog, so each open starts from the department's current name.
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
      <DepartmentFormDialog
        key={formKey}
        department={department}
        locationChoice={locationChoice}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
