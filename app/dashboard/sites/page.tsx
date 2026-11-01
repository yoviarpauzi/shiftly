import { SitesDataTable } from "@/components/dashboard/sites/data-table";
import { requireSuperadmin } from "@/lib/session";
import { parsePageParams } from "@/validation/pagination";
import { parseSiteStatus } from "@/validation/site-status";
import { parseSortParam } from "@/validation/sort";
import { listSites } from "./sites";

const SITE_SORT_COLUMNS = ["name", "locations", "status"] as const;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperadmin();

  const params = await searchParams;
  const status = parseSiteStatus(params.status);
  const sort = parseSortParam(params.sort, SITE_SORT_COLUMNS);
  const sites = await listSites({ ...parsePageParams(params), status, sort });

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Sites</h1>
        <p className="text-sm text-muted-foreground">
          All sites and the locations in each one.
        </p>
      </div>
      <SitesDataTable data={sites} status={status} sort={sort} />
    </div>
  );
}
