import { ShiftsDataTable } from "@/components/dashboard/shifts/data-table";
import { parseLocationSite } from "@/validation/location-site";
import { parsePageParams } from "@/validation/pagination";
import { parseShiftStatus } from "@/validation/shift-status";
import { parseSortParam } from "@/validation/sort";
import { requireShiftManager } from "./shift-guard";
import { listShifts, shiftSiteChoiceFor } from "./shifts";

const SHIFT_SORT_COLUMNS = ["number", "name", "site", "status"] as const;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireShiftManager();

  const params = await searchParams;
  const status = parseShiftStatus(params.status);
  const sort = parseSortParam(params.sort, SHIFT_SORT_COLUMNS);
  const siteChoice = await shiftSiteChoiceFor(access);
  // Only superadmin picks a site, so a site-bound user gets no site filter and its ?site= is ignored.
  const siteId = parseLocationSite(
    params.site,
    siteChoice.mode === "pick" ? siteChoice.sites : [],
  );
  const shifts = await listShifts(access, {
    ...parsePageParams(params),
    status,
    siteId,
    sort,
  });

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Shifts</h1>
        <p className="text-sm text-muted-foreground">
          Shifts in the sites you can manage.
        </p>
      </div>
      <ShiftsDataTable
        data={shifts}
        status={status}
        siteId={siteId}
        siteChoice={siteChoice}
        sort={sort}
      />
    </div>
  );
}
