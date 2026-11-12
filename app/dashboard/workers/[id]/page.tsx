import { Suspense } from "react";
import { notFound } from "next/navigation";
import { EditWorkerButton } from "@/components/dashboard/workers/history/edit-worker-button";
import { HistoryCards } from "@/components/dashboard/workers/history/history-cards";
import { HistoryEmpty } from "@/components/dashboard/workers/history/history-empty";
import { HistoryFilters } from "@/components/dashboard/workers/history/history-filters";
import { HistoryMonthNav } from "@/components/dashboard/workers/history/history-month-nav";
import { HistoryPager } from "@/components/dashboard/workers/history/history-pager";
import { HistorySummary } from "@/components/dashboard/workers/history/history-summary";
import { HistoryTable } from "@/components/dashboard/workers/history/history-table";
import { WorkerProfileCard } from "@/components/dashboard/workers/history/worker-profile-card";
import { Skeleton } from "@/components/ui/skeleton";
import { parsePageParams } from "@/validation/pagination";
import { parseSortParam } from "@/validation/sort";
import { parseWorkerHistoryParams } from "@/validation/worker-history";
import { parseWorkerId } from "@/validation/worker-id";
import { requireWorkerManager } from "../worker-guard";
import { loadWorkerMonth, workerHasHistory } from "../worker-history";
import {
  buildWorkerHistory,
  historyHref,
  monthBounds,
  monthLabel,
  workerToday,
} from "../worker-history-rules";
import { getWorkerDetail, workerFormOptionsFor } from "../workers";

const HISTORY_SORT_COLUMNS = ["date"] as const;

function WorkerDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-20" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="flex flex-col gap-2 rounded-lg border p-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

async function WorkerDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireWorkerManager();

  const { id } = await params;

  // A malformed id would make the uuid comparison throw in Postgres, so it is a 404 instead.
  if (!parseWorkerId(id)) {
    notFound();
  }

  // getWorkerDetail is scoped. It gives the 404 for a missing or out-of-scope id, so no history is
  // read before it passes. A deleted worker opens: its history outlives the delete.
  const worker = await getWorkerDetail(access, id);

  if (!worker) {
    notFound();
  }

  const query = await searchParams;
  const today = workerToday(worker.timezone);
  const filters = parseWorkerHistoryParams(query, today);
  const sort = parseSortParam(query.sort, HISTORY_SORT_COLUMNS);
  const { page, pageSize } = parsePageParams(query);

  const [rows, options] = await Promise.all([
    loadWorkerMonth(access, worker.id, monthBounds(filters.month, today)),
    worker.deletedAt === null ? workerFormOptionsFor(access) : Promise.resolve(null),
  ]);
  const view = buildWorkerHistory(rows, filters, {
    page,
    pageSize,
    direction: sort[0]?.direction ?? "desc",
  });
  // An empty month is either a quiet month or a worker who was never in a confirmed roster.
  const hasHistory = rows.length > 0 || (await workerHasHistory(access, worker.id));

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold break-words">{worker.name}</h1>
          <p className="text-sm text-muted-foreground">
            {worker.employeeId} · {worker.siteName}, {worker.locationName}
          </p>
        </div>
        {options ? <EditWorkerButton worker={worker} options={options} /> : null}
      </div>
      <WorkerProfileCard worker={worker} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium">Work history</h2>
          {hasHistory ? (
            <HistoryMonthNav
              workerId={worker.id}
              params={query}
              month={filters.month}
              today={today}
            />
          ) : null}
        </div>
        {!hasHistory ? (
          <HistoryEmpty kind="none" workerName={worker.name} />
        ) : (
          <>
            <HistorySummary summary={view.summary} />
            {rows.length === 0 ? (
              <HistoryEmpty kind="month" monthLabel={monthLabel(filters.month)} />
            ) : (
              <>
                <HistoryFilters
                  workerId={worker.id}
                  params={query}
                  filters={filters}
                  choices={view.choices}
                />
                {view.total === 0 ? (
                  <HistoryEmpty
                    kind="filtered"
                    clearHref={historyHref(worker.id, query, {
                      department: null,
                      shift: null,
                      type: null,
                      attendance: null,
                    })}
                  />
                ) : (
                  <>
                    <div className="hidden md:block">
                      <HistoryTable data={view} sort={sort} />
                    </div>
                    <div className="md:hidden">
                      <HistoryCards rows={view.rows} />
                    </div>
                    <HistoryPager
                      page={view.page}
                      pageSize={view.pageSize}
                      total={view.total}
                      monthTotal={rows.length}
                    />
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<WorkerDetailSkeleton />}>
      <WorkerDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}
