"use client";

import { BanIcon, DownloadIcon, PencilIcon, ReceiptTextIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { formatBillingPeriod } from "@/app/dashboard/billings/billing-rules";
import { periodInputFor } from "@/app/dashboard/billings/billing-period";
import { Button, buttonVariants } from "@/components/ui/button";
import type { BillingActionsProps } from "@/types/billings";
import { DeleteBillingDialog } from "./delete-billing-dialog";
import { EditPeriodDialog } from "./edit-period-dialog";
import { IssueBillingDialog } from "./issue-billing-dialog";
import { VoidBillingDialog } from "./void-billing-dialog";

type DialogName = "edit" | "issue" | "delete" | "void";

// The actions of one billing. A Draft can be edited, deleted or issued, an Issued billing can be
// exported or voided, and a Void billing has none. The server checks every action again.
export function BillingActions({ billing }: BillingActionsProps) {
  const [dialog, setDialog] = useState<DialogName | null>(null);
  // A new key remounts a dialog on each open, so it starts from the loaded billing, not from what
  // the last open left in it.
  const [openCount, setOpenCount] = useState(0);

  function show(name: DialogName) {
    setOpenCount((count) => count + 1);
    setDialog(name);
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setDialog(null);
    }
  }

  const dialogProps = (name: DialogName) => ({
    billingId: billing.id,
    open: dialog === name,
    onOpenChange: handleOpenChange,
  });

  if (billing.status === "void") {
    return null;
  }

  if (billing.status === "issued") {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/dashboard/billings/${billing.id}/export`}
            download
            className={buttonVariants({ variant: "outline" })}
          >
            <DownloadIcon data-icon="inline-start" />
            Export Excel
          </a>
          <Button variant="destructive" onClick={() => show("void")}>
            <BanIcon data-icon="inline-start" />
            Void
          </Button>
        </div>
        <VoidBillingDialog
          key={`void-${openCount}`}
          {...dialogProps("void")} version={billing.version} number={billing.number} />
      </>
    );
  }

  const isEmpty = billing.groups.totalDays === 0;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => show("edit")}>
          <PencilIcon data-icon="inline-start" />
          Edit period
        </Button>
        <Button variant="outline" onClick={() => show("delete")}>
          <Trash2Icon data-icon="inline-start" />
          Delete draft
        </Button>
        <Button disabled={isEmpty} onClick={() => show("issue")}>
          <ReceiptTextIcon data-icon="inline-start" />
          Issue
        </Button>
      </div>
      <EditPeriodDialog
        key={`edit-${openCount}`}
        {...dialogProps("edit")}
        version={billing.version}
        initialPeriod={periodInputFor(billing.mode, {
          from: billing.periodStart,
          to: billing.periodEnd,
        })}
      />
      <DeleteBillingDialog key={`delete-${openCount}`} {...dialogProps("delete")} />
      <IssueBillingDialog
        key={`issue-${openCount}`}
        {...dialogProps("issue")}
        version={billing.version}
        locationName={billing.locationName}
        periodLabel={formatBillingPeriod(billing.periodStart, billing.periodEnd)}
        groups={billing.groups}
      />
    </>
  );
}
