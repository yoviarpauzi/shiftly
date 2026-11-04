import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RosterDetailView } from "@/components/dashboard/rosters/roster-detail";
import { RosterStatusBadge } from "@/components/dashboard/rosters/roster-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { parseRequestId } from "@/validation/request-id";
import { formatRequestDates } from "../../requests/request-rules";
import { requireRosterUser } from "../roster-guard";
import { formatRosterTime, splitsToTargets } from "../roster-rules";
import { getGenerateView, getRoster } from "../rosters";

async function RosterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { access } = await requireRosterUser();

  const { id } = await params;

  // A malformed id would make the uuid comparison throw in Postgres, so it is a 404 instead.
  if (!parseRequestId(id)) {
    notFound();
  }

  // getRoster is scoped, so a missing and an out-of-scope id both give the 404.
  const roster = await getRoster(access, id);

  if (!roster) {
    notFound();
  }

  // Generate again repeats the split the draft was made with. A request that is no longer approved
  // has no Generate view, and so no Generate again.
  const view = roster.editable ? await getGenerateView(access, roster.requestId) : null;
  const generateInput = view
    ? {
        requestId: view.requestId,
        targets: splitsToTargets(
          view.lines.map((line) => line.lineId),
          view.days,
          view.shifts.map((shift) => shift.id),
          view.lines.map((line) => line.split),
        ),
        version: roster.version,
      }
    : null;

  const typeLabel = roster.type === "weekly" ? "Weekly" : "Daily";
  const generated = `Generated ${roster.generatedByName ? `by ${roster.generatedByName} ` : ""}on ${formatRosterTime(roster.generatedAt)}.`;
  const confirmed =
    roster.status === "confirmed" && roster.confirmedAt
      ? ` Confirmed ${roster.confirmedByName ? `by ${roster.confirmedByName} ` : ""}on ${formatRosterTime(roster.confirmedAt)}.`
      : "";

  return (
    <div className="px-4 py-4 md:py-6 lg:px-6">
      <RosterDetailView
        roster={roster}
        generateInput={generateInput}
        header={
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold break-all">{roster.poNumber}</h1>
              <RosterStatusBadge status={roster.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {typeLabel}, {formatRequestDates(roster.type, roster.startDate)}, at{" "}
              {roster.locationName}. {generated}
              {confirmed}
            </p>
          </div>
        }
      />
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <RosterDetailPage params={params} />
    </Suspense>
  );
}
