import { RostersDataTable } from "@/components/dashboard/rosters/data-table";
import { RostersFilters } from "@/components/dashboard/rosters/rosters-filters";
import type { RosterSortColumn } from "@/types/rosters";
import { parsePageParams } from "@/validation/pagination";
import { parseRequestLocation } from "@/validation/request-location";
import { parseRequestSite } from "@/validation/request-site";
import { parseRosterFilters } from "@/validation/rosters";
import { parseSortParam } from "@/validation/sort";
import { requestLocationsFor } from "../requests/request-rules";
import { requestChoicesFor } from "../requests/requests";
import { requireRosterUser } from "./roster-guard";
import { listRosters } from "./rosters";

const ROSTER_SORT_COLUMNS = [
  "po",
  "type",
  "date",
  "location",
  "status",
] as const satisfies readonly RosterSortColumn[];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { access } = await requireRosterUser();

  const params = await searchParams;
  const parsed = parseRosterFilters(params);
  // The Roster menu has the Request menu's scope, so the same choices feed its filters.
  const choices = await requestChoicesFor(access);
  // Only a superadmin with several sites picks a site. HO and admin site are already scoped.
  const pickSite =
    access.siteId === null && access.locationId === null && choices.sites.length > 1;
  const siteId = parseRequestSite(params.site, pickSite ? choices.sites : []);
  const locations = requestLocationsFor(choices.locations, siteId, pickSite);
  // Only locations of the chosen site count, so a ?location= outside it is ignored.
  const locationId = parseRequestLocation(params.location, locations);
  const filters = { ...parsed, siteId, locationId };

  const rosters = await listRosters(access, {
    ...parsePageParams(params),
    ...filters,
    sort: parseSortParam(params.sort, ROSTER_SORT_COLUMNS),
  });

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Roster</h1>
        <p className="text-sm text-muted-foreground">
          Generate and confirm rosters for approved requests.
        </p>
      </div>
      <RostersFilters
        filters={filters}
        sites={pickSite ? choices.sites.map(({ id, name }) => ({ id, name })) : []}
        locations={locations}
      />
      <RostersDataTable page={rosters} />
    </div>
  );
}
