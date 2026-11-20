import { RostersDataTable } from "@/components/dashboard/rosters/data-table";
import { RostersFilters } from "@/components/dashboard/rosters/rosters-filters";
import type { RosterSortColumn } from "@/types/rosters";
import { parsePageParams } from "@/validation/pagination";
import { parseRequestLocation } from "@/validation/request-location";
import { parseRosterFilters } from "@/validation/rosters";
import { parseSortParam } from "@/validation/sort";
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
  const locations = choices.locations;
  // Only locations the actor can see count, so a ?location= outside them is ignored.
  const locationId = parseRequestLocation(params.location, locations);
  const filters = { ...parsed, locationId };

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
        locations={locations.map(({ id, name }) => ({ id, name }))}
      />
      <RostersDataTable page={rosters} />
    </div>
  );
}
