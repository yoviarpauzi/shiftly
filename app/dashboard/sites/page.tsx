import { SitesDataTable } from "@/components/dashboard/sites/data-table";
import { parsePageParams } from "@/lib/pagination";
import { requireSuperadmin } from "@/lib/session";
import { listSites } from "./sites";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperadmin();

  const sites = await listSites(parsePageParams(await searchParams));

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Sites</h1>
        <p className="text-sm text-muted-foreground">
          All sites and the locations in each one.
        </p>
      </div>
      <SitesDataTable data={sites} />
    </div>
  );
}
