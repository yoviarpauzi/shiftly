import { PositionsDataTable } from "@/components/dashboard/positions/data-table";
import { parsePageParams } from "@/validation/pagination";
import { parsePositionStatus } from "@/validation/position-status";
import { parseSortParam } from "@/validation/sort";
import { requirePositionManager } from "./position-guard";
import { listPositions } from "./positions";

const POSITION_SORT_COLUMNS = ["name", "status"] as const;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePositionManager();

  const params = await searchParams;
  const status = parsePositionStatus(params.status);
  const sort = parseSortParam(params.sort, POSITION_SORT_COLUMNS);
  const positions = await listPositions({
    ...parsePageParams(params),
    status,
    sort,
  });

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Positions</h1>
        <p className="text-sm text-muted-foreground">Positions that workers can hold.</p>
      </div>
      <PositionsDataTable data={positions} status={status} sort={sort} />
    </div>
  );
}
