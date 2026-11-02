import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RequestForm } from "@/components/dashboard/requests/request-form";
import { RequestFormSkeleton } from "@/components/dashboard/requests/request-form-skeleton";
import { RequestStatusBadge } from "@/components/dashboard/requests/request-status-badge";
import { parseRequestId } from "@/validation/request-id";
import { isReadOnlyStatus } from "../request-form-options";
import { requireRequestUser } from "../request-guard";
import { formatRequestDates } from "../request-rules";
import { getRequest, requestChoicesFor } from "../requests";

async function RequestDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { access } = await requireRequestUser();

  const { id } = await params;

  // A malformed id would make the uuid comparison throw in Postgres, so it is a 404 instead.
  if (!parseRequestId(id)) {
    notFound();
  }

  // getRequest is scoped, so a missing and an out-of-scope id both give the 404.
  const request = await getRequest(access, id);

  if (!request) {
    notFound();
  }

  const choices = await requestChoicesFor(access);
  const typeLabel = request.type === "weekly" ? "Weekly" : "Daily";

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold break-all">{request.poNumber}</h1>
          <RequestStatusBadge status={request.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {typeLabel}, {formatRequestDates(request.type, request.startDate)}, at{" "}
          {request.locationName}. Created by {request.createdByName}.
        </p>
      </div>
      {request.rejectReason && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">Reject reason</p>
          <p className="whitespace-pre-line">{request.rejectReason}</p>
        </div>
      )}
      <RequestForm
        request={request}
        choices={choices}
        readOnly={isReadOnlyStatus(request.status)}
      />
    </div>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<RequestFormSkeleton />}>
      <RequestDetailView params={params} />
    </Suspense>
  );
}
