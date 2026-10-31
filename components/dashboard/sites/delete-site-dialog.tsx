"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteSite } from "@/app/dashboard/sites/actions";
import type { SiteRow } from "@/app/dashboard/sites/sites";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type DeleteSiteDialogProps = {
  site: SiteRow | null;
  onOpenChange: (open: boolean) => void;
};

export function DeleteSiteDialog({
  site,
  onOpenChange,
}: DeleteSiteDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setFormError(null);
    }

    onOpenChange(open);
  }

  async function handleDelete() {
    if (!site) {
      return;
    }

    setFormError(null);
    setIsDeleting(true);

    const result = await deleteSite(site.id);

    setIsDeleting(false);

    if (!result.ok) {
      setFormError(result.formError ?? null);
      return;
    }

    toast.success("Site deleted");
    handleOpenChange(false);
  }

  return (
    <AlertDialog open={site !== null} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {site?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The site moves to Deleted. You can restore it from that filter.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {formError && (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            {isDeleting && <Spinner data-icon="inline-start" />}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
