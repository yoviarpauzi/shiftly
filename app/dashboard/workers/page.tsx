import { WorkersDataTable } from "@/components/dashboard/workers/data-table";
import { WorkersEndingNotice } from "@/components/dashboard/workers/workers-ending-notice";
import { parsePageParams } from "@/validation/pagination";
import { parseSortParam } from "@/validation/sort";
import { parseWorkerEnding } from "@/validation/worker-ending";
import { parseWorkerLocation } from "@/validation/worker-location";
import { parseWorkerPosition } from "@/validation/worker-position";
import { parseWorkerStatus } from "@/validation/worker-status";
import { requireWorkerManager } from "./worker-guard";
import { listWorkers, workerFormOptionsFor } from "./workers";

const WORKER_SORT_COLUMNS = ["employeeId", "name", "location", "status"] as const;

// The same URL without the ending filter. The page number goes too, since the list changes.
function clearEndingHref(params: Record<string, string | string[] | undefined>): string {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === "ending" || key === "page" || value === undefined) {
      continue;
    }

    for (const item of Array.isArray(value) ? value : [value]) {
      next.append(key, item);
    }
  }

  const query = next.toString();

  return query ? `/dashboard/workers?${query}` : "/dashboard/workers";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireWorkerManager();

  const params = await searchParams;
  const status = parseWorkerStatus(params.status);
  const sort = parseSortParam(params.sort, WORKER_SORT_COLUMNS);
  const options = await workerFormOptionsFor(access);
  // Admin site has one location, so it gets no location filter. HO filters by any location.
  const locations = access.locationId ? [] : options.locations;
  const locationId = parseWorkerLocation(params.location, locations);
  const positions = options.positions;
  const positionId = parseWorkerPosition(params.position, positions);
  const ending = parseWorkerEnding(params.ending);
  const workers = await listWorkers(access, {
    ...parsePageParams(params),
    status,
    locationId,
    positionId,
    ending,
    sort,
  });

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Workers</h1>
        <p className="text-sm text-muted-foreground">
          Workers in the locations you can manage, with their positions.
        </p>
      </div>
      {ending ? <WorkersEndingNotice clearHref={clearEndingHref(params)} /> : null}
      <WorkersDataTable
        data={workers}
        status={status}
        sort={sort}
        options={options}
        locations={locations}
        locationId={locationId}
        positions={positions}
        positionId={positionId}
      />
    </div>
  );
}
