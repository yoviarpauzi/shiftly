import { RequestsDataTable } from "@/components/dashboard/requests/data-table";
import type { RequestSortColumn } from "@/types/requests";
import { parsePageParams } from "@/validation/pagination";
import { parseRequestLocation } from "@/validation/request-location";
import { parseRequestSite } from "@/validation/request-site";
import {
  parseRequestStatus,
  parseRequestType,
} from "@/validation/request-status";
import { parseSortParam } from "@/validation/sort";
import { requireRequestUser } from "./request-guard";
import { requestLocationsFor } from "./request-rules";
import { listRequests, requestChoicesFor } from "./requests";

const REQUEST_SORT_COLUMNS = [
  "po",
  "type",
  "date",
  "location",
  "status",
] as const satisfies readonly RequestSortColumn[];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, access } = await requireRequestUser();

  const params = await searchParams;
  const status = parseRequestStatus(params.status);
  const type = parseRequestType(params.type);
  const sort = parseSortParam(params.sort, REQUEST_SORT_COLUMNS);
  const choices = await requestChoicesFor(access);
  // Only a superadmin with several sites picks a site. HO and admin site are already scoped.
  const pickSite =
    access.siteId === null && access.locationId === null && choices.sites.length > 1;
  const siteId = parseRequestSite(params.site, pickSite ? choices.sites : []);
  const locations = requestLocationsFor(choices.locations, siteId, pickSite);
  // Only locations of the chosen site count, so a ?location= outside it is ignored.
  const locationId = parseRequestLocation(params.location, locations);
  const requests = await listRequests(access, {
    ...parsePageParams(params),
    status,
    type,
    siteId,
    locationId,
    sort,
  });

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Requests</h1>
        <p className="text-sm text-muted-foreground">
          Roster requests for the locations you can manage.
        </p>
      </div>
      <RequestsDataTable
        data={requests}
        status={status}
        type={type}
        pickSite={pickSite}
        siteId={siteId}
        sites={choices.sites.map(({ id, name }) => ({ id, name }))}
        locationId={locationId}
        locations={locations.map(({ id, name }) => ({ id, name }))}
        sort={sort}
        // HO is scoped to its own site, so every row it sees is one it may decide.
        canDecide={user.role === "superadmin" || user.role === "ho"}
      />
    </div>
  );
}
