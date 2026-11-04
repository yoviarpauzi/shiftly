import { notFound, redirect } from "next/navigation";
import { GenerateForm } from "@/components/dashboard/rosters/generate-form";
import { formatRequestDates } from "../../requests/request-rules";
import { requireRosterUser } from "../roster-guard";
import { getGenerateView } from "../rosters";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { access } = await requireRosterUser();

  const params = await searchParams;
  const requestId = Array.isArray(params.request) ? params.request[0] : params.request;
  const view = requestId ? await getGenerateView(access, requestId) : null;

  // An unknown, unapproved, or out-of-scope request is the same as a missing one.
  if (!view) {
    notFound();
  }

  if (view.existingRosterId && view.existingStatus === "confirmed") {
    redirect(`/dashboard/rosters/${view.existingRosterId}`);
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Generate roster</h1>
        <p className="text-sm text-muted-foreground">
          {view.poNumber} · {view.type === "weekly" ? "Weekly" : "Daily"},{" "}
          {formatRequestDates(view.type, view.startDate)}, at {view.locationName}. Set how many
          workers each shift needs.
        </p>
      </div>
      <GenerateForm view={view} />
    </div>
  );
}
