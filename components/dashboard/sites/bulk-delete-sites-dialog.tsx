"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteSites } from "@/app/dashboard/sites/actions";
import { bulkDeleteMessage } from "@/app/dashboard/sites/site-rules";
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

type BulkDeleteSitesDialogProps = {
  sites: SiteRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BulkDeleteSitesDialog({
  sites,
  open,
  onOpenChange,
}: BulkDeleteSitesDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const result = await deleteSites(sites.map((site) => site.id));
      const names = new Map(sites.map((site) => [site.id, site.name]));
      const message = bulkDeleteMessage(
        result.deletedIds.length,
        result.blocked.length,
      );

      if (result.blocked.length > 0) {
        const description = result.blocked
          .map((item) => `${names.get(item.id)}: ${item.formError}`)
          .join("\n");

        toast.error(message, { description });
      } else {
        toast.success(message);
      }

      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  }

  const count = sites.length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count} {count === 1 ? "site" : "sites"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The selected sites move to Deleted and can be restored from that
            filter. A site with active locations or assigned HO users is kept,
            and the reason is shown.
          </AlertDialogDescription>
        </AlertDialogHeader>
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
