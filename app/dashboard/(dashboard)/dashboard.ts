import "server-only";
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  notInArray,
  sql,
  type SQL,
} from "drizzle-orm";
import { lastDays, scopeToday, weekDays } from "@/app/dashboard/(dashboard)/dashboard-rules";
import { addDays } from "@/app/dashboard/rosters/roster-rules";
import { contractEndingFilter } from "@/app/dashboard/workers/workers";
import { attendance } from "@/database/schema/attendance-schema";
import { location } from "@/database/schema/location-schema";
import { rosterRequest } from "@/database/schema/request-schema";
import { roster, rosterAssignment, rosterConflict } from "@/database/schema/roster-schema";
import { site } from "@/database/schema/site-schema";
import { worker } from "@/database/schema/worker-schema";
import { db } from "@/lib/db";
import type { RequestStatus, RequestType } from "@/types/requests";
import type {
  AttendanceCounts,
  AttentionCounts,
  Breakdown,
  DashboardKpis,
  DashboardRole,
  DashboardScope,
  LocationRow,
  ScopeZone,
  SeriesPoint,
  SiteRow,
  WeekPoint,
} from "@/types/dashboard";

const SERIES_DAYS = 30;
const RECENT_REQUESTS = 3;

function countWhere(condition: SQL): SQL<number> {
  return sql<number>`count(*) filter (where ${condition})`.mapWith(Number);
}

function scopeIds(scope: DashboardScope): string[] {
  return scope.locations.map((row) => row.id);
}

// A roster is live only while its request is approved. A roster of a cancelled request stays on
// record, read-only, and is never counted, as in the Roster and Attendance menus.
const liveRequest = () => eq(rosterRequest.status, "approved");

// A scheduled shift: a work assignment in a confirmed roster of an approved request in one of the
// zone's locations, dated from `from` to `to`. Every shift metric reads through this one condition.
// The worker, department, and position are not joined, so a shift keeps counting after they are
// soft-deleted.
function scheduledShifts(locationIds: string[], from: string, to: string, ...extra: SQL[]) {
  return and(
    eq(roster.status, "confirmed"),
    liveRequest(),
    eq(rosterAssignment.kind, "work"),
    inArray(rosterRequest.locationId, locationIds),
    gte(rosterAssignment.workDate, from),
    lte(rosterAssignment.workDate, to),
    ...extra,
  );
}

// Per date: distinct workers, shifts, and the attendance status of the same shifts. A shift with
// no attendance row counts in `scheduled` only. attendance is unique per assignment, so the left
// join never repeats a shift.
function shiftCounts(zone: ScopeZone, from: string, to: string) {
  return db
    .select({
      workDate: rosterAssignment.workDate,
      workers: countDistinct(rosterAssignment.workerId),
      scheduled: count(),
      present: countWhere(sql`${attendance.status} = ${"present"}`),
      absent: countWhere(sql`${attendance.status} = ${"absent"}`),
      sick: countWhere(sql`${attendance.status} = ${"sick"}`),
      leave: countWhere(sql`${attendance.status} = ${"leave"}`),
    })
    .from(rosterAssignment)
    .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .leftJoin(attendance, eq(attendance.rosterAssignmentId, rosterAssignment.id))
    .where(scheduledShifts(zone.locationIds, from, to))
    .groupBy(rosterAssignment.workDate);
}

// Per location: draft rosters, the conflict rows they hold, and how many of them hold any.
function draftCounts(locationIds: string[]) {
  return db
    .select({
      locationId: rosterRequest.locationId,
      draftRosters: countDistinct(roster.id),
      conflicts: count(rosterConflict.id),
      conflictedRosters: countDistinct(rosterConflict.rosterId),
    })
    .from(roster)
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .leftJoin(rosterConflict, eq(rosterConflict.rosterId, roster.id))
    .where(
      and(eq(roster.status, "draft"), liveRequest(), inArray(rosterRequest.locationId, locationIds)),
    )
    .groupBy(rosterRequest.locationId);
}

// Per location of the zone: pending requests and the oldest day one was made (in the location's
// zone), and the requests whose period overlaps the zone's Monday to Sunday week. A daily request
// covers its start date, a weekly request seven days from it.
function requestCounts(zone: ScopeZone) {
  const week = weekDays(zone.today);
  const monday = week[0];
  const sunday = week[6];
  const overlaps = sql`${rosterRequest.startDate} <= ${sunday} and ${rosterRequest.startDate} + (case when ${rosterRequest.type} = 'weekly' then 6 else 0 end) >= ${monday}`;
  const pending = sql`${rosterRequest.status} = ${"pending"}`;

  return db
    .select({
      locationId: rosterRequest.locationId,
      pending: countWhere(pending),
      oldestPending: sql<
        string | null
      >`min((timezone(${location.timezone}, ${rosterRequest.createdAt}))::date) filter (where ${pending})`,
      thisWeek: countWhere(
        sql`${notInArray(rosterRequest.status, ["rejected", "cancelled"])} and ${overlaps}`,
      ),
      thisWeekPending: countWhere(sql`${pending} and ${overlaps}`),
    })
    .from(rosterRequest)
    .innerJoin(location, eq(location.id, rosterRequest.locationId))
    .where(inArray(rosterRequest.locationId, zone.locationIds))
    .groupBy(rosterRequest.locationId);
}

type RequestCountRow = Awaited<ReturnType<typeof requestCounts>>[number];
type DraftCountRow = Awaited<ReturnType<typeof draftCounts>>[number];

function requestCountsByZone(scope: DashboardScope): Promise<RequestCountRow[]> {
  return Promise.all(scope.zones.map(requestCounts)).then((zones) => zones.flat());
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

function emptyCounts(): AttendanceCounts {
  return { scheduled: 0, present: 0, absent: 0, sick: 0, leave: 0 };
}

function addCounts(target: AttendanceCounts, row: AttendanceCounts): void {
  target.scheduled += row.scheduled;
  target.present += row.present;
  target.absent += row.absent;
  target.sick += row.sick;
  target.leave += row.leave;
}

export async function getKpis(scope: DashboardScope): Promise<DashboardKpis> {
  const kpis: DashboardKpis = {
    workersToday: 0,
    workersYesterday: 0,
    today: emptyCounts(),
    yesterday: emptyCounts(),
    openConflicts: 0,
    conflictedRosters: 0,
    pendingRequests: 0,
    oldestPendingDate: null,
    requestsThisWeek: 0,
    requestsThisWeekPending: 0,
  };

  if (scope.zones.length === 0) {
    return kpis;
  }

  const [shifts, drafts, requests] = await Promise.all([
    Promise.all(
      scope.zones.map((zone) => shiftCounts(zone, addDays(zone.today, -1), zone.today)),
    ),
    draftCounts(scopeIds(scope)),
    requestCountsByZone(scope),
  ]);

  // Each zone adds its own today and yesterday, so a date shared by two zones is not mixed up.
  scope.zones.forEach((zone, index) => {
    const yesterday = addDays(zone.today, -1);

    for (const row of shifts[index]) {
      if (row.workDate === zone.today) {
        kpis.workersToday += row.workers;
        addCounts(kpis.today, row);
      } else if (row.workDate === yesterday) {
        kpis.workersYesterday += row.workers;
        addCounts(kpis.yesterday, row);
      }
    }
  });

  kpis.openConflicts = sum(drafts, (row) => row.conflicts);
  kpis.conflictedRosters = sum(drafts, (row) => row.conflictedRosters);
  kpis.pendingRequests = sum(requests, (row) => row.pending);
  kpis.requestsThisWeek = sum(requests, (row) => row.thisWeek);
  kpis.requestsThisWeekPending = sum(requests, (row) => row.thisWeekPending);

  // YYYY-MM-DD strings sort as dates.
  const oldest = requests
    .map((row) => row.oldestPending)
    .filter((date): date is string => date !== null)
    .sort();

  kpis.oldestPendingDate = oldest[0] ?? null;

  return kpis;
}

// The last 30 days up to the latest today, oldest first. A zone counts up to its own today only.
// With no zone, 30 zero days and no query, so the chart keeps its axis.
export async function getAttendanceSeries(scope: DashboardScope): Promise<SeriesPoint[]> {
  const days = lastDays(scopeToday(scope.zones), SERIES_DAYS);
  const points = new Map(days.map((date) => [date, { date, present: 0, notPresent: 0 }]));

  if (scope.zones.length === 0) {
    return [...points.values()];
  }

  const zones = await Promise.all(scope.zones.map((zone) => shiftCounts(zone, days[0], zone.today)));

  for (const row of zones.flat()) {
    const point = points.get(row.workDate);

    if (point) {
      point.present += row.present;
      point.notPresent += row.absent + row.sick + row.leave;
    }
  }

  return [...points.values()];
}

// Per location, today's scheduled shifts with no attendance row. A location appears only when it
// has at least one.
function unmarkedShifts(zone: ScopeZone) {
  return db
    .select({ locationId: rosterRequest.locationId, shifts: count() })
    .from(rosterAssignment)
    .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .leftJoin(attendance, eq(attendance.rosterAssignmentId, rosterAssignment.id))
    .where(scheduledShifts(zone.locationIds, zone.today, zone.today, isNull(attendance.id)))
    .groupBy(rosterRequest.locationId);
}

export async function getAttentionCounts(scope: DashboardScope): Promise<AttentionCounts> {
  if (scope.zones.length === 0) {
    return {
      pendingRequests: 0,
      draftRosters: 0,
      conflicts: 0,
      conflictedRosters: 0,
      unmarkedLocations: [],
      unmarkedWorkers: 0,
      contractsEnding: 0,
    };
  }

  const ids = scopeIds(scope);

  const [requests, drafts, unmarked, contracts] = await Promise.all([
    requestCountsByZone(scope),
    draftCounts(ids),
    Promise.all(scope.zones.map(unmarkedShifts)).then((zones) => zones.flat()),
    // The filter already reads each worker's own location zone and keeps active workers only.
    db
      .select({ total: count() })
      .from(worker)
      .where(and(contractEndingFilter(), inArray(worker.locationId, ids))),
  ]);

  const unmarkedIds = new Set(unmarked.filter((row) => row.shifts > 0).map((row) => row.locationId));

  return {
    pendingRequests: sum(requests, (row) => row.pending),
    draftRosters: sum(drafts, (row) => row.draftRosters),
    conflicts: sum(drafts, (row) => row.conflicts),
    conflictedRosters: sum(drafts, (row) => row.conflictedRosters),
    unmarkedLocations: scope.locations
      .filter((row) => unmarkedIds.has(row.id))
      .map((row) => ({ id: row.id, siteId: row.siteId })),
    unmarkedWorkers: sum(unmarked, (row) => row.shifts),
    contractsEnding: contracts[0]?.total ?? 0,
  };
}

// Per date of the zone's week, the conflict rows in draft rosters.
function gapCounts(zone: ScopeZone, monday: string, sunday: string) {
  return db
    .select({ workDate: rosterConflict.workDate, value: count() })
    .from(rosterConflict)
    .innerJoin(roster, eq(roster.id, rosterConflict.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .where(
      and(
        eq(roster.status, "draft"),
        liveRequest(),
        inArray(rosterRequest.locationId, zone.locationIds),
        gte(rosterConflict.workDate, monday),
        lte(rosterConflict.workDate, sunday),
      ),
    )
    .groupBy(rosterConflict.workDate);
}

// Seven points, Monday first, on the week of the latest today. Each zone is read on its own week
// and merged by date, so they differ only for the few hours one zone is in the next week. With no
// zone, seven zero days and no query.
export async function getWeekChart(
  scope: DashboardScope,
  kind: "gaps" | "scheduled",
): Promise<WeekPoint[]> {
  const points = new Map(weekDays(scopeToday(scope.zones)).map((date) => [date, { date, value: 0 }]));

  if (scope.zones.length === 0) {
    return [...points.values()];
  }

  const zones = await Promise.all(
    scope.zones.map(async (zone) => {
      const week = weekDays(zone.today);

      if (kind === "gaps") {
        return gapCounts(zone, week[0], week[6]);
      }

      const rows = await shiftCounts(zone, week[0], week[6]);

      return rows.map((row) => ({ workDate: row.workDate, value: row.workers }));
    }),
  );

  for (const row of zones.flat()) {
    const point = points.get(row.workDate);

    if (point) {
      point.value += row.value;
    }
  }

  return [...points.values()];
}

// Per location, active workers on the books: the headcount, not today's schedule.
function workerCounts(locationIds: string[]) {
  return db
    .select({ locationId: worker.locationId, workers: count() })
    .from(worker)
    .where(and(isNull(worker.deletedAt), inArray(worker.locationId, locationIds)))
    .groupBy(worker.locationId);
}

async function locationRows(scope: DashboardScope): Promise<LocationRow[]> {
  const ids = scopeIds(scope);

  const [workers, requests, drafts] = await Promise.all([
    workerCounts(ids),
    requestCountsByZone(scope),
    draftCounts(ids),
  ]);

  const byLocation = <T extends { locationId: string }>(rows: T[]) =>
    new Map(rows.map((row) => [row.locationId, row]));
  const workersAt = byLocation(workers);
  const requestsAt = byLocation<RequestCountRow>(requests);
  const draftsAt = byLocation<DraftCountRow>(drafts);

  return scope.locations.map((row) => ({
    id: row.id,
    name: row.name,
    workers: workersAt.get(row.id)?.workers ?? 0,
    pendingRequests: requestsAt.get(row.id)?.pending ?? 0,
    draftRosters: draftsAt.get(row.id)?.draftRosters ?? 0,
    conflicts: draftsAt.get(row.id)?.conflicts ?? 0,
  }));
}

// Every active site gets a row, a site with no location in scope a row of zeros. With no location
// at all, only the sites are read.
async function siteRows(scope: DashboardScope): Promise<SiteRow[]> {
  const [sites, locations] = await Promise.all([
    db
      .select({ id: site.id, name: site.name })
      .from(site)
      .where(
        and(
          isNull(site.deletedAt),
          scope.access.siteId ? eq(site.id, scope.access.siteId) : undefined,
        ),
      )
      .orderBy(asc(site.name), asc(site.id)),
    scope.locations.length > 0 ? locationRows(scope) : [],
  ]);

  const siteOf = new Map(scope.locations.map((row) => [row.id, row.siteId]));

  return sites.map(({ id, name }) => {
    const own = locations.filter((row) => siteOf.get(row.id) === id);

    return {
      id,
      name,
      locations: own.length,
      workers: sum(own, (row) => row.workers),
      pendingRequests: sum(own, (row) => row.pendingRequests),
      draftRosters: sum(own, (row) => row.draftRosters),
      conflicts: sum(own, (row) => row.conflicts),
    };
  });
}

function recentRequests(scope: DashboardScope) {
  return db
    .select({
      id: rosterRequest.id,
      poNumber: rosterRequest.poNumber,
      type: sql<RequestType>`${rosterRequest.type}`,
      startDate: rosterRequest.startDate,
      status: sql<RequestStatus>`${rosterRequest.status}`,
    })
    .from(rosterRequest)
    .where(inArray(rosterRequest.locationId, scopeIds(scope)))
    .orderBy(desc(rosterRequest.createdAt), desc(rosterRequest.id))
    .limit(RECENT_REQUESTS);
}

// Superadmin sees By site, HO By location, and admin site its latest requests.
export async function getBreakdown(scope: DashboardScope, role: DashboardRole): Promise<Breakdown> {
  // A superadmin's sites are listed even with no location, as rows of zeros.
  if (role === "superadmin") {
    return { kind: "sites", rows: await siteRows(scope) };
  }

  const kind = role === "ho" ? "locations" : "requests";

  if (scope.zones.length === 0) {
    return { kind, rows: [] };
  }

  if (kind === "locations") {
    return { kind, rows: await locationRows(scope) };
  }

  return { kind, rows: await recentRequests(scope) };
}
