import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { BillingActions } from "@/components/dashboard/billings/billing-actions";
import { BillingPoTable } from "@/components/dashboard/billings/billing-po-table";
import { BillingStatusBadge } from "@/components/dashboard/billings/billing-status-badge";
import { BillingSummary } from "@/components/dashboard/billings/billing-summary";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { BillingDetail } from "@/types/billings";
import { parseBillingId } from "@/validation/billings";
import { requireBillingUser } from "../billing-guard";
import {
  BILLING_MODE_LABELS,
  formatBillingIssuedAt,
  formatBillingPeriod,
} from "../billing-rules";
import { getBilling } from "../billings";

// Who issued or voided the billing, and on which day, as plain text under the heading.
function historyLines(billing: BillingDetail): string[] {
  const lines: string[] = [];

  if (billing.createdByName) {
    lines.push(`Created by ${billing.createdByName}.`);
  }

  if (billing.issuedAt) {
    const by = billing.issuedByName ? ` by ${billing.issuedByName}` : "";

    lines.push(`Issued${by} on ${formatBillingIssuedAt(billing.issuedAt)}.`);
  }

  return lines;
}

function VoidNotice({ billing }: { billing: BillingDetail }) {
  const by = billing.voidedByName ? ` by ${billing.voidedByName}` : "";

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
      <p className="font-medium text-destructive">
        Voided{by} on {formatBillingIssuedAt(billing.voidedAt)}
      </p>
      <p className="whitespace-pre-line break-words">
        <span className="font-medium">Reason:</span> {billing.voidReason}
      </p>
    </div>
  );
}

async function BillingDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { access } = await requireBillingUser();

  const id = parseBillingId((await params).id);

  // A malformed id would make the uuid comparison throw in Postgres, so it is a 404 instead.
  if (!id) {
    notFound();
  }

  // getBilling is scoped, so a missing and an out-of-scope id both give the 404.
  const billing = await getBilling(access, id);

  if (!billing) {
    notFound();
  }

  const { groups } = billing;
  const isDraft = billing.status === "draft";

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/billings"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit" })}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Back to billing
        </Link>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold break-all">{billing.number ?? "Draft"}</h1>
            <BillingStatusBadge status={billing.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {billing.locationName}, {billing.siteName}. {BILLING_MODE_LABELS[billing.mode]} billing
            for {formatBillingPeriod(billing.periodStart, billing.periodEnd)}.{" "}
            {historyLines(billing).join(" ")}
          </p>
        </div>
        <BillingActions billing={billing} />
      </div>
      {billing.status === "void" && <VoidNotice billing={billing} />}
      <BillingSummary
        totalDays={groups.totalDays}
        poCount={groups.pos.length}
        excludedDays={billing.excludedDays}
      />
      {groups.pos.length === 0 ? (
        <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          {isDraft
            ? "No billable days in this period yet"
            : "This billing has no lines"}
        </p>
      ) : (
        <>
          {groups.pos.map((group) => (
            <BillingPoTable key={group.requestId} group={group} />
          ))}
          <p className="flex items-center justify-between gap-4 rounded-lg border bg-muted px-4 py-3 font-medium">
            <span>Total</span>
            <span className="tabular-nums">
              {groups.totalDays} {groups.totalDays === 1 ? "day" : "days"}
            </span>
          </p>
        </>
      )}
    </div>
  );
}

function BillingDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<BillingDetailSkeleton />}>
      <BillingDetailView params={params} />
    </Suspense>
  );
}
