import { LocationsDataTable } from "@/components/dashboard/locations/data-table";
import { requireLocationManager } from "./location-guard";
import { parseLocationStatus } from "@/validation/location-status";
import { parsePageParams } from "@/validation/pagination";
import { parseSortParam } from "@/validation/sort";
import { listLocations, siteChoiceFor } from "./locations";

const LOCATION_SORT_COLUMNS = ["name", "site", "status"] as const;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireLocationManager();

  const params = await searchParams;
  const status = parseLocationStatus(params.status);
  const sort = parseSortParam(params.sort, LOCATION_SORT_COLUMNS);
  const locations = await listLocations(access, {
    ...parsePageParams(params),
    status,
    sort,
  });
  const siteChoice = await siteChoiceFor(access);

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Locations</h1>
        <p className="text-sm text-muted-foreground">
          Locations in the sites you can manage.
        </p>
      </div>
      <LocationsDataTable
        data={locations}
        status={status}
        siteChoice={siteChoice}
        sort={sort}
      />
    </div>
  );
}
