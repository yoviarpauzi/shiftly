import { ShiftsDataTable } from "@/components/dashboard/shifts/data-table";
import { parsePageParams } from "@/validation/pagination";
import { parseShiftLocation } from "@/validation/shift-location";
import { parseShiftSite } from "@/validation/shift-site";
import { parseShiftStatus } from "@/validation/shift-status";
import { parseSortParam } from "@/validation/sort";
import { requireShiftManager } from "./shift-guard";
import { shiftLocationsForSite, shiftSitesOf } from "./shift-rules";
import { listShifts, shiftLocationChoiceFor } from "./shifts";

const SHIFT_SORT_COLUMNS = ["order", "name", "location", "status"] as const;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireShiftManager();

  const params = await searchParams;
  const status = parseShiftStatus(params.status);
  const sort = parseSortParam(params.sort, SHIFT_SORT_COLUMNS);
  const locationChoice = await shiftLocationChoiceFor(access);
  const pickable = locationChoice.mode === "pick" ? locationChoice.locations : [];
  // Only superadmin picks a site, so HO and admin site get no site filter.
  const sites = access.siteId === null && access.locationId === null ? shiftSitesOf(pickable) : null;
  const siteId = parseShiftSite(params.site, sites ?? []);
  // Superadmin picks a site first, so until then there are no locations to filter by. HO has one site, so
  // its locations are listed as they are. Admin site gets no filter and its ?location= is ignored.
  const locations = sites && !siteId ? [] : siteId ? shiftLocationsForSite(pickable, siteId) : pickable;
  const locationId = parseShiftLocation(params.location, locations);
  const shifts = await listShifts(access, {
    ...parsePageParams(params),
    status,
    siteId,
    locationId,
    sort,
  });

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Shifts</h1>
        <p className="text-sm text-muted-foreground">
          Shifts in the locations you can manage.
        </p>
      </div>
      <ShiftsDataTable
        data={shifts}
        status={status}
        sites={sites}
        siteId={siteId}
        locations={locations}
        locationId={locationId}
        locationChoice={locationChoice}
        sort={sort}
      />
    </div>
  );
}
