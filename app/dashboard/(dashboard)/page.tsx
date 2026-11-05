import { Suspense } from "react";

import { AttendanceChart } from "@/components/dashboard/overview/attendance-chart";
import { AttentionList } from "@/components/dashboard/overview/attention-list";
import { BreakdownTable } from "@/components/dashboard/overview/breakdown-table";
import { KpiCards } from "@/components/dashboard/overview/kpi-cards";
import { OverviewHeader } from "@/components/dashboard/overview/overview-header";
import { OverviewSkeleton } from "@/components/dashboard/overview/overview-skeleton";
import { WeekChart } from "@/components/dashboard/overview/week-chart";
import { dateInZone } from "@/lib/indonesia-date";
import { DEFAULT_LOCATION_TIMEZONE } from "@/validation/location";
import {
  getAttendanceSeries,
  getAttentionCounts,
  getBreakdown,
  getKpis,
  getWeekChart,
} from "./dashboard";
import { requireDashboardUser } from "./dashboard-guard";
import {
  attentionItems,
  dashboardSubtitle,
  kpiCards,
  weekChartCopy,
} from "./dashboard-rules";
import { dashboardScopeFor } from "./dashboard-scope";

async function DashboardView() {
  const { role, access } = await requireDashboardUser();
  const scope = await dashboardScopeFor(access);

  const [kpis, series, counts, week, breakdown] = await Promise.all([
    getKpis(scope),
    getAttendanceSeries(scope),
    getAttentionCounts(scope),
    getWeekChart(scope, role === "admin_site" ? "scheduled" : "gaps"),
    getBreakdown(scope, role),
  ]);

  const place = scope.locations[0] ?? null;
  const today = scope.zones[0]?.today ?? dateInZone(DEFAULT_LOCATION_TIMEZONE);
  const siteName = role === "superadmin" ? null : (place?.siteName ?? null);
  const locationName = role === "admin_site" ? (place?.name ?? null) : null;

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <OverviewHeader role={role} subtitle={dashboardSubtitle(role, { siteName, locationName })} />
      <KpiCards cards={kpiCards(role, kpis)} />
      <AttendanceChart series={series} />
      <div className="grid grid-cols-1 gap-4 md:gap-6 @4xl/main:grid-cols-2">
        <AttentionList items={attentionItems(role, counts, today)} />
        <WeekChart points={week} {...weekChartCopy(role, kpis)} />
      </div>
      <BreakdownTable
        breakdown={breakdown}
        contextName={role === "ho" ? siteName : locationName}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <DashboardView />
    </Suspense>
  );
}
