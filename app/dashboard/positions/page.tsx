import { PositionsDataTable } from "@/components/dashboard/positions/data-table";
import { parseLocationSite } from "@/validation/location-site";
import { parsePageParams } from "@/validation/pagination";
import { parsePositionStatus } from "@/validation/position-status";
import { parseSortParam } from "@/validation/sort";
import { requirePositionManager } from "./position-guard";
import { listPositions, positionSiteChoiceFor } from "./positions";

const POSITION_SORT_COLUMNS = ["name", "site", "status"] as const;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requirePositionManager();

  const params = await searchParams;
  const status = parsePositionStatus(params.status);
  const sort = parseSortParam(params.sort, POSITION_SORT_COLUMNS);
  const siteChoice = await positionSiteChoiceFor(access);
  // Only superadmin picks a site, so a site-bound user gets no site filter and its ?site= is ignored.
  const siteId = parseLocationSite(
    params.site,
    siteChoice.mode === "pick" ? siteChoice.sites : [],
  );
  const positions = await listPositions(access, {
    ...parsePageParams(params),
    status,
    siteId,
    sort,
  });

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Positions</h1>
        <p className="text-sm text-muted-foreground">
          Positions in the sites you can manage.
        </p>
      </div>
      <PositionsDataTable
        data={positions}
        status={status}
        siteId={siteId}
        siteChoice={siteChoice}
        sort={sort}
      />
    </div>
  );
}
