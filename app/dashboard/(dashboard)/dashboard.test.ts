import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attendance } from "@/database/schema/attendance-schema";
import { location } from "@/database/schema/location-schema";
import { rosterRequest } from "@/database/schema/request-schema";
import { roster, rosterAssignment, rosterConflict } from "@/database/schema/roster-schema";
import { site } from "@/database/schema/site-schema";
import { worker } from "@/database/schema/worker-schema";
import type { DashboardScope, ScopeLocation } from "@/types/dashboard";

// The database is replaced by a recorder. Each select is logged as a Call with its columns, joins,
// where, groupBy, orderBy, and limit, and its rows come from `fake.answer`. The recorder cannot run
// SQL, so the tests render the recorded SQL with PgDialect and assert on its text and params, and
// feed the grouped rows the database would return to check how they are merged.
type Call = {
  columns: Record<string, unknown>;
  table?: unknown;
  joins: { kind: "inner" | "left"; table: unknown }[];
  where?: SQL;
  groupBy?: unknown[];
  orderBy?: SQL[];
  limit?: number;
};

const fake = vi.hoisted(() => ({
  calls: [] as unknown[],
  answer: (() => []) as (call: never) => unknown[],
}));

const dialect = new PgDialect();

function builder(columns: Record<string, unknown>) {
  const call: Call = { columns, joins: [] };
  fake.calls.push(call);

  const chain = {
    from(table: unknown) {
      call.table = table;
      return chain;
    },
    innerJoin(table: unknown) {
      call.joins.push({ kind: "inner", table });
      return chain;
    },
    leftJoin(table: unknown) {
      call.joins.push({ kind: "left", table });
      return chain;
    },
    where(condition: SQL) {
      call.where = condition;
      return chain;
    },
    groupBy(...terms: unknown[]) {
      call.groupBy = terms;
      return chain;
    },
    orderBy(...terms: SQL[]) {
      call.orderBy = terms;
      return chain;
    },
    limit(value: number) {
      call.limit = value;
      return chain;
    },
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      return new Promise((done) => done((fake.answer as (call: Call) => unknown[])(call))).then(
        resolve,
        reject,
      );
    },
  };

  return chain;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: { select: (columns: Record<string, unknown>) => builder(columns) },
}));

const { getAttendanceSeries, getAttentionCounts, getBreakdown, getKpis, getWeekChart } =
  await import("./dashboard");
const { contractEndingFilter } = await import("@/app/dashboard/workers/workers");

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const SITE_C = "23232323-2323-4323-8323-232323232323";
const LOC_A = "33333333-3333-4333-8333-333333333333";
const LOC_B = "44444444-4444-4444-8444-444444444444";
const LOC_C = "55555555-5555-4555-8555-555555555555";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function scopeLocation(overrides: Partial<ScopeLocation>): ScopeLocation {
  return {
    id: LOC_A,
    name: "Gudang Utara",
    siteId: SITE_A,
    siteName: "Nestle Kejayan",
    timezone: "Asia/Jakarta",
    ...overrides,
  };
}

// Two zones: WIB is still on Monday 9 Nov while WITA is already on Tuesday 10 Nov. Location A and C
// are in WIB, B is in WITA. A and B belong to site A, C to site B.
const twoZones: DashboardScope = {
  access: { siteId: null, locationId: null },
  locations: [
    scopeLocation({ id: LOC_A, name: "Gudang Utara" }),
    scopeLocation({ id: LOC_B, name: "Gudang Timur", timezone: "Asia/Makassar" }),
    scopeLocation({ id: LOC_C, name: "Plant 1", siteId: SITE_B, siteName: "Indofood Cikarang" }),
  ],
  zones: [
    { timezone: "Asia/Jakarta", today: "2026-11-09", locationIds: [LOC_A, LOC_C] },
    { timezone: "Asia/Makassar", today: "2026-11-10", locationIds: [LOC_B] },
  ],
};

const emptyScope: DashboardScope = {
  access: { siteId: null, locationId: null },
  locations: [],
  zones: [],
};

function calls(): Call[] {
  return fake.calls as Call[];
}

function callsOn(table: unknown): Call[] {
  return calls().filter((call) => call.table === table);
}

function render(fragment: SQL | undefined): { sql: string; params: unknown[] } {
  if (!fragment) {
    throw new Error("Expected a SQL fragment");
  }

  const { sql, params } = dialect.sqlToQuery(fragment);

  return { sql, params };
}

function column(call: Call, key: string): { sql: string; params: unknown[] } {
  return render(call.columns[key] as SQL);
}

// The location ids a call names, in the order its params hold them.
function idsOf(call: Call): unknown[] {
  return render(call.where).params.filter((param) => typeof param === "string" && UUID.test(param));
}

function zoneOf(call: Call): "WIB" | "WITA" {
  const ids = idsOf(call);

  return ids.includes(LOC_B) ? "WITA" : "WIB";
}

// A scheduled shift: a work assignment in a confirmed roster of an approved request. A roster of a
// cancelled request stays on record and must never count.
function scheduledWhere(ids: number): string {
  const list = Array.from({ length: ids }, (_, index) => `$${index + 4}`).join(", ");

  return `("roster"."status" = $1 and "roster_request"."status" = $2 and "roster_assignment"."kind" = $3 and "roster_request"."location_id" in (${list}) and "roster_assignment"."work_date" >= $${ids + 4} and "roster_assignment"."work_date" <= $${ids + 5}`;
}

function expectScheduledJoins(call: Call) {
  expect(call.table).toBe(rosterAssignment);
  expect(call.joins).toEqual([
    { kind: "inner", table: roster },
    { kind: "inner", table: rosterRequest },
    { kind: "left", table: attendance },
  ]);
}

// No call names a location outside the scope.
function expectOnlyScopeIds() {
  for (const call of calls()) {
    if (!call.where) continue;

    for (const id of idsOf(call)) {
      expect([LOC_A, LOC_B, LOC_C]).toContain(id);
    }
  }
}

beforeEach(() => {
  fake.calls = [];
  fake.answer = () => [];
});

describe("a scope with no locations", () => {
  it("returns zeros and empty lists without querying", async () => {
    expect(await getKpis(emptyScope)).toEqual({
      workersToday: 0,
      workersYesterday: 0,
      today: { scheduled: 0, present: 0, absent: 0, sick: 0, leave: 0 },
      yesterday: { scheduled: 0, present: 0, absent: 0, sick: 0, leave: 0 },
      openConflicts: 0,
      conflictedRosters: 0,
      pendingRequests: 0,
      oldestPendingDate: null,
      requestsThisWeek: 0,
      requestsThisWeekPending: 0,
    });
    expect(await getAttentionCounts(emptyScope)).toEqual({
      pendingRequests: 0,
      draftRosters: 0,
      conflicts: 0,
      conflictedRosters: 0,
      unmarkedLocations: [],
      unmarkedWorkers: 0,
      contractsEnding: 0,
    });
    expect(await getBreakdown(emptyScope, "ho")).toEqual({ kind: "locations", rows: [] });
    expect(await getBreakdown(emptyScope, "admin_site")).toEqual({ kind: "requests", rows: [] });

    expect(calls()).toHaveLength(0);
  });

  describe("charts", () => {
    beforeEach(() => {
      // 17:30 UTC on Thursday 12 Nov is Friday 13 Nov in WIB, the default zone.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-11-12T17:30:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("zero-fills 30 days to today in the default zone, without querying", async () => {
      const series = await getAttendanceSeries(emptyScope);

      expect(series).toHaveLength(30);
      expect(series[0]).toEqual({ date: "2026-10-15", present: 0, notPresent: 0 });
      expect(series[29]).toEqual({ date: "2026-11-13", present: 0, notPresent: 0 });
      expect(series.every((point) => point.present === 0 && point.notPresent === 0)).toBe(true);
      expect(calls()).toHaveLength(0);
    });

    it("zero-fills the default zone's week, Monday first, without querying", async () => {
      const week = [
        "2026-11-09",
        "2026-11-10",
        "2026-11-11",
        "2026-11-12",
        "2026-11-13",
        "2026-11-14",
        "2026-11-15",
      ].map((date) => ({ date, value: 0 }));

      expect(await getWeekChart(emptyScope, "gaps")).toEqual(week);
      expect(await getWeekChart(emptyScope, "scheduled")).toEqual(week);
      expect(calls()).toHaveLength(0);
    });
  });

  it("still lists every active site as a zero row for a superadmin", async () => {
    fake.answer = (call: Call) =>
      call.table === site
        ? [
            { id: SITE_B, name: "Indofood Cikarang" },
            { id: SITE_A, name: "Nestle Kejayan" },
          ]
        : [];

    const zero = { locations: 0, workers: 0, pendingRequests: 0, draftRosters: 0, conflicts: 0 };

    expect(await getBreakdown(emptyScope, "superadmin")).toEqual({
      kind: "sites",
      rows: [
        { id: SITE_B, name: "Indofood Cikarang", ...zero },
        { id: SITE_A, name: "Nestle Kejayan", ...zero },
      ],
    });

    // Only the sites are read: there is no location to count anything in.
    expect(calls()).toHaveLength(1);
    expect(calls()[0].table).toBe(site);
  });
});

describe("getKpis", () => {
  it("runs one scheduled-shift query per zone, on that zone's yesterday and today", async () => {
    await getKpis(twoZones);

    const shifts = callsOn(rosterAssignment);
    expect(shifts).toHaveLength(2);

    const [wib, wita] = shifts;
    expectScheduledJoins(wib);
    expectScheduledJoins(wita);

    expect(render(wib.where)).toEqual({
      sql: `${scheduledWhere(2)})`,
      params: ["confirmed", "approved", "work", LOC_A, LOC_C, "2026-11-08", "2026-11-09"],
    });
    expect(render(wita.where)).toEqual({
      sql: `${scheduledWhere(1)})`,
      params: ["confirmed", "approved", "work", LOC_B, "2026-11-09", "2026-11-10"],
    });
    expect(wib.groupBy).toEqual([rosterAssignment.workDate]);

    // Distinct workers, and the attendance statuses of the same rows.
    expect(column(wib, "workers").sql).toBe(
      'count(distinct "roster_assignment"."worker_id")',
    );
    expect(column(wib, "scheduled").sql).toBe("count(*)");
    expect(column(wib, "present")).toEqual({
      sql: 'count(*) filter (where "attendance"."status" = $1)',
      params: ["present"],
    });
    expect(column(wib, "leave").params).toEqual(["leave"]);

    expectOnlyScopeIds();
  });

  it("adds each zone's today and yesterday, not the rows of a shared date", async () => {
    const shift = (workDate: string, workers: number, present: number, absent = 0) => ({
      workDate,
      workers,
      scheduled: workers,
      present,
      absent,
      sick: 0,
      leave: 0,
    });

    fake.answer = (call: Call) => {
      if (call.table !== rosterAssignment) return [];

      return zoneOf(call) === "WIB"
        ? [shift("2026-11-08", 3, 2, 1), shift("2026-11-09", 5, 4)]
        : // 9 Nov is WITA's yesterday, though it is WIB's today.
          [shift("2026-11-09", 7, 6), shift("2026-11-10", 2, 0)];
    };

    const kpis = await getKpis(twoZones);

    expect(kpis.workersToday).toBe(7);
    expect(kpis.workersYesterday).toBe(10);
    expect(kpis.today).toEqual({ scheduled: 7, present: 4, absent: 0, sick: 0, leave: 0 });
    expect(kpis.yesterday).toEqual({ scheduled: 10, present: 8, absent: 1, sick: 0, leave: 0 });
  });

  it("counts conflict rows and their rosters in draft rosters of the scope", async () => {
    fake.answer = (call: Call) =>
      call.table === roster
        ? [
            { locationId: LOC_A, draftRosters: 1, conflicts: 3, conflictedRosters: 1 },
            { locationId: LOC_B, draftRosters: 2, conflicts: 2, conflictedRosters: 1 },
          ]
        : [];

    const kpis = await getKpis(twoZones);

    const [drafts] = callsOn(roster);
    expect(callsOn(roster)).toHaveLength(1);
    expect(drafts.joins).toEqual([
      { kind: "inner", table: rosterRequest },
      { kind: "left", table: rosterConflict },
    ]);
    expect(render(drafts.where)).toEqual({
      sql: '("roster"."status" = $1 and "roster_request"."status" = $2 and "roster_request"."location_id" in ($3, $4, $5))',
      params: ["draft", "approved", LOC_A, LOC_B, LOC_C],
    });
    expect(drafts.groupBy).toEqual([rosterRequest.locationId]);
    // Rows, not the shortfall they carry.
    expect(column(drafts, "conflicts").sql).toBe('count("roster_conflict"."id")');
    expect(column(drafts, "conflictedRosters").sql).toBe(
      'count(distinct "roster_conflict"."roster_id")',
    );
    expect(column(drafts, "draftRosters").sql).toBe('count(distinct "roster"."id")');

    expect(kpis.openConflicts).toBe(5);
    expect(kpis.conflictedRosters).toBe(2);
  });

  it("counts requests per zone: pending, the oldest pending day, and this week's", async () => {
    fake.answer = (call: Call) => {
      if (call.table !== rosterRequest) return [];

      return zoneOf(call) === "WIB"
        ? [
            {
              locationId: LOC_A,
              pending: 2,
              oldestPending: "2026-11-06",
              thisWeek: 3,
              thisWeekPending: 1,
            },
            {
              locationId: LOC_C,
              pending: 0,
              oldestPending: null,
              thisWeek: 1,
              thisWeekPending: 0,
            },
          ]
        : [
            {
              locationId: LOC_B,
              pending: 1,
              oldestPending: "2026-11-04",
              thisWeek: 2,
              thisWeekPending: 1,
            },
          ];
    };

    const kpis = await getKpis(twoZones);

    const requests = callsOn(rosterRequest);
    expect(requests).toHaveLength(2);

    const [wib, wita] = requests;
    expect(wib.joins).toEqual([{ kind: "inner", table: location }]);
    expect(render(wib.where)).toEqual({
      sql: '"roster_request"."location_id" in ($1, $2)',
      params: [LOC_A, LOC_C],
    });
    expect(render(wita.where)).toEqual({
      sql: '"roster_request"."location_id" in ($1)',
      params: [LOC_B],
    });
    expect(wib.groupBy).toEqual([rosterRequest.locationId]);

    expect(column(wib, "pending")).toEqual({
      sql: 'count(*) filter (where "roster_request"."status" = $1)',
      params: ["pending"],
    });
    expect(column(wib, "oldestPending")).toEqual({
      sql: 'min((timezone("location"."timezone", "roster_request"."created_at"))::date) filter (where "roster_request"."status" = $1)',
      params: ["pending"],
    });

    const overlap =
      '"roster_request"."start_date" <= $3 and "roster_request"."start_date" + (case when "roster_request"."type" = \'weekly\' then 6 else 0 end) >= $4';

    expect(column(wib, "thisWeek")).toEqual({
      sql: `count(*) filter (where "roster_request"."status" not in ($1, $2) and ${overlap})`,
      params: ["rejected", "cancelled", "2026-11-15", "2026-11-09"],
    });
    expect(column(wib, "thisWeekPending")).toEqual({
      sql: `count(*) filter (where "roster_request"."status" = $1 and ${overlap.replace("$3", "$2").replace("$4", "$3")})`,
      params: ["pending", "2026-11-15", "2026-11-09"],
    });

    expect(kpis.pendingRequests).toBe(3);
    expect(kpis.oldestPendingDate).toBe("2026-11-04");
    expect(kpis.requestsThisWeek).toBe(6);
    expect(kpis.requestsThisWeekPending).toBe(2);

    expectOnlyScopeIds();
  });

  it("uses each zone's own week for the requests of this week", async () => {
    // WITA has reached Monday 16 Nov while WIB is still on Sunday 15 Nov.
    const edge: DashboardScope = {
      ...twoZones,
      zones: [
        { timezone: "Asia/Jakarta", today: "2026-11-15", locationIds: [LOC_A, LOC_C] },
        { timezone: "Asia/Makassar", today: "2026-11-16", locationIds: [LOC_B] },
      ],
    };

    await getKpis(edge);

    const [wib, wita] = callsOn(rosterRequest);
    expect(column(wib, "thisWeek").params.slice(2)).toEqual(["2026-11-15", "2026-11-09"]);
    expect(column(wita, "thisWeek").params.slice(2)).toEqual(["2026-11-22", "2026-11-16"]);
  });

  it("gives no oldest pending date when nothing is pending", async () => {
    fake.answer = (call: Call) =>
      call.table === rosterRequest
        ? [{ locationId: LOC_A, pending: 0, oldestPending: null, thisWeek: 0, thisWeekPending: 0 }]
        : [];

    expect((await getKpis(twoZones)).oldestPendingDate).toBeNull();
  });
});

describe("getAttendanceSeries", () => {
  it("queries each zone from the first day of the axis to its own today", async () => {
    await getAttendanceSeries(twoZones);

    const [wib, wita] = callsOn(rosterAssignment);
    expect(callsOn(rosterAssignment)).toHaveLength(2);
    expectScheduledJoins(wib);

    expect(render(wib.where)).toEqual({
      sql: `${scheduledWhere(2)})`,
      params: ["confirmed", "approved", "work", LOC_A, LOC_C, "2026-10-12", "2026-11-09"],
    });
    expect(render(wita.where)).toEqual({
      sql: `${scheduledWhere(1)})`,
      params: ["confirmed", "approved", "work", LOC_B, "2026-10-12", "2026-11-10"],
    });
    expect(calls()).toHaveLength(2);
  });

  it("returns 30 days oldest first, zero-filled, adding the zones on a shared date", async () => {
    const day = (workDate: string, present: number, absent: number, sick: number, leave: number) => ({
      workDate,
      workers: present + absent + sick + leave,
      scheduled: present + absent + sick + leave,
      present,
      absent,
      sick,
      leave,
    });

    fake.answer = (call: Call) =>
      zoneOf(call) === "WIB"
        ? [day("2026-11-09", 4, 1, 1, 0)]
        : [day("2026-11-09", 2, 0, 0, 1), day("2026-11-10", 1, 0, 0, 0)];

    const series = await getAttendanceSeries(twoZones);

    expect(series).toHaveLength(30);
    expect(series[0]).toEqual({ date: "2026-10-12", present: 0, notPresent: 0 });
    expect(series[28]).toEqual({ date: "2026-11-09", present: 6, notPresent: 3 });
    expect(series[29]).toEqual({ date: "2026-11-10", present: 1, notPresent: 0 });
    expect(series.filter((point) => point.present + point.notPresent > 0)).toHaveLength(2);
  });
});

describe("getAttentionCounts", () => {
  it("finds today's scheduled shifts with no attendance row, per zone and location", async () => {
    fake.answer = (call: Call) => {
      if (call.table !== rosterAssignment) return [];

      // Location A has no row: everything there is marked, or nothing is scheduled.
      return zoneOf(call) === "WIB"
        ? [{ locationId: LOC_C, shifts: 2 }]
        : [{ locationId: LOC_B, shifts: 3 }];
    };

    const counts = await getAttentionCounts(twoZones);

    const [wib, wita] = callsOn(rosterAssignment);
    expect(callsOn(rosterAssignment)).toHaveLength(2);
    expectScheduledJoins(wib);

    expect(render(wib.where)).toEqual({
      sql: `${scheduledWhere(2)} and "attendance"."id" is null)`,
      params: ["confirmed", "approved", "work", LOC_A, LOC_C, "2026-11-09", "2026-11-09"],
    });
    expect(render(wita.where)).toEqual({
      sql: `${scheduledWhere(1)} and "attendance"."id" is null)`,
      params: ["confirmed", "approved", "work", LOC_B, "2026-11-10", "2026-11-10"],
    });
    expect(wib.groupBy).toEqual([rosterRequest.locationId]);
    expect(column(wib, "shifts").sql).toBe("count(*)");

    // In the order of the scope's locations, each with its site for the Attendance link.
    expect(counts.unmarkedLocations).toEqual([
      { id: LOC_B, siteId: SITE_A },
      { id: LOC_C, siteId: SITE_B },
    ]);
    expect(counts.unmarkedWorkers).toBe(5);
  });

  it("adds pending requests, draft rosters, conflicts, and contracts ending in scope", async () => {
    fake.answer = (call: Call) => {
      if (call.table === roster) {
        return [
          { locationId: LOC_A, draftRosters: 2, conflicts: 4, conflictedRosters: 1 },
          { locationId: LOC_C, draftRosters: 1, conflicts: 0, conflictedRosters: 0 },
        ];
      }

      if (call.table === rosterRequest) {
        return zoneOf(call) === "WIB"
          ? [{ locationId: LOC_A, pending: 2, oldestPending: "2026-11-06", thisWeek: 0, thisWeekPending: 0 }]
          : [{ locationId: LOC_B, pending: 1, oldestPending: "2026-11-05", thisWeek: 0, thisWeekPending: 0 }];
      }

      if (call.table === worker) return [{ total: 4 }];

      return [];
    };

    const counts = await getAttentionCounts(twoZones);

    expect(counts).toEqual({
      pendingRequests: 3,
      draftRosters: 3,
      conflicts: 4,
      conflictedRosters: 1,
      unmarkedLocations: [],
      unmarkedWorkers: 0,
      contractsEnding: 4,
    });

    const [drafts] = callsOn(roster);
    expect(render(drafts.where).params).toEqual(["draft", "approved", LOC_A, LOC_B, LOC_C]);

    const [contracts] = callsOn(worker);
    expect(callsOn(worker)).toHaveLength(1);
    const ending = render(contractEndingFilter());
    const { sql, params } = render(contracts.where);
    expect(sql).toBe(`(${ending.sql} and "worker"."location_id" in ($1, $2, $3))`);
    expect(params).toEqual([...ending.params, LOC_A, LOC_B, LOC_C]);

    expectOnlyScopeIds();
  });
});

describe("getWeekChart", () => {
  it("counts conflict rows in draft rosters per day of each zone's week", async () => {
    fake.answer = (call: Call) =>
      zoneOf(call) === "WIB"
        ? [
            { workDate: "2026-11-09", value: 2 },
            { workDate: "2026-11-11", value: 1 },
          ]
        : [{ workDate: "2026-11-11", value: 3 }];

    const points = await getWeekChart(twoZones, "gaps");

    const [wib, wita] = callsOn(rosterConflict);
    expect(calls()).toHaveLength(2);
    expect(wib.joins).toEqual([
      { kind: "inner", table: roster },
      { kind: "inner", table: rosterRequest },
    ]);
    expect(render(wib.where)).toEqual({
      sql: '("roster"."status" = $1 and "roster_request"."status" = $2 and "roster_request"."location_id" in ($3, $4) and "roster_conflict"."work_date" >= $5 and "roster_conflict"."work_date" <= $6)',
      params: ["draft", "approved", LOC_A, LOC_C, "2026-11-09", "2026-11-15"],
    });
    expect(render(wita.where).params).toEqual(["draft", "approved", LOC_B, "2026-11-09", "2026-11-15"]);
    expect(wib.groupBy).toEqual([rosterConflict.workDate]);
    // Conflict rows, never the shortfall.
    expect(column(wib, "value").sql).toBe("count(*)");

    expect(points).toEqual([
      { date: "2026-11-09", value: 2 },
      { date: "2026-11-10", value: 0 },
      { date: "2026-11-11", value: 4 },
      { date: "2026-11-12", value: 0 },
      { date: "2026-11-13", value: 0 },
      { date: "2026-11-14", value: 0 },
      { date: "2026-11-15", value: 0 },
    ]);
  });

  it("counts distinct scheduled workers per day, Monday first", async () => {
    const thursday: DashboardScope = {
      ...twoZones,
      locations: [twoZones.locations[0]],
      zones: [{ timezone: "Asia/Jakarta", today: "2026-11-12", locationIds: [LOC_A] }],
    };

    fake.answer = () => [
      { workDate: "2026-11-09", workers: 5, scheduled: 6, present: 0, absent: 0, sick: 0, leave: 0 },
      { workDate: "2026-11-15", workers: 2, scheduled: 2, present: 0, absent: 0, sick: 0, leave: 0 },
    ];

    const points = await getWeekChart(thursday, "scheduled");

    const [shifts] = callsOn(rosterAssignment);
    expect(calls()).toHaveLength(1);
    expectScheduledJoins(shifts);
    expect(render(shifts.where)).toEqual({
      sql: `${scheduledWhere(1)})`,
      params: ["confirmed", "approved", "work", LOC_A, "2026-11-09", "2026-11-15"],
    });

    expect(points.map((point) => point.date)).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
    expect(points[0].value).toBe(5);
    expect(points[6].value).toBe(2);
    expect(points[3].value).toBe(0);
  });
});

describe("getBreakdown", () => {
  function feedCounts(call: Call): unknown[] {
    if (call.table === site) {
      return [
        { id: SITE_B, name: "Indofood Cikarang" },
        { id: SITE_C, name: "Mayora Tangerang" },
        { id: SITE_A, name: "Nestle Kejayan" },
      ];
    }

    if (call.table === worker) {
      return [
        { locationId: LOC_A, workers: 10 },
        { locationId: LOC_B, workers: 5 },
      ];
    }

    if (call.table === roster) {
      return [{ locationId: LOC_B, draftRosters: 1, conflicts: 2, conflictedRosters: 1 }];
    }

    if (call.table === rosterRequest) {
      return zoneOf(call) === "WIB"
        ? [{ locationId: LOC_A, pending: 1, oldestPending: "2026-11-06", thisWeek: 1, thisWeekPending: 1 }]
        : [{ locationId: LOC_B, pending: 2, oldestPending: "2026-11-05", thisWeek: 2, thisWeekPending: 2 }];
    }

    return [];
  }

  it("gives superadmin one row per active site, with zeros for a site with nothing", async () => {
    fake.answer = feedCounts;

    const breakdown = await getBreakdown(twoZones, "superadmin");

    expect(breakdown).toEqual({
      kind: "sites",
      rows: [
        { id: SITE_B, name: "Indofood Cikarang", locations: 1, workers: 0, pendingRequests: 0, draftRosters: 0, conflicts: 0 },
        { id: SITE_C, name: "Mayora Tangerang", locations: 0, workers: 0, pendingRequests: 0, draftRosters: 0, conflicts: 0 },
        { id: SITE_A, name: "Nestle Kejayan", locations: 2, workers: 15, pendingRequests: 3, draftRosters: 1, conflicts: 2 },
      ],
    });

    const [sites] = callsOn(site);
    expect(render(sites.where)).toEqual({ sql: '"site"."deleted_at" is null', params: [] });
    expect(sites.orderBy?.map((term) => render(term).sql)).toEqual([
      '"site"."name" asc',
      '"site"."id" asc',
    ]);

    // Active workers on the books, not today's schedule.
    const [workers] = callsOn(worker);
    expect(render(workers.where)).toEqual({
      sql: '("worker"."deleted_at" is null and "worker"."location_id" in ($1, $2, $3))',
      params: [LOC_A, LOC_B, LOC_C],
    });
    expect(workers.groupBy).toEqual([worker.locationId]);
    expect(column(workers, "workers").sql).toBe("count(*)");

    expectOnlyScopeIds();
  });

  it("limits the sites to the scope's site when the access names one", async () => {
    fake.answer = feedCounts;

    await getBreakdown({ ...twoZones, access: { siteId: SITE_A, locationId: null } }, "superadmin");

    const [sites] = callsOn(site);
    expect(render(sites.where)).toEqual({
      sql: '("site"."deleted_at" is null and "site"."id" = $1)',
      params: [SITE_A],
    });
  });

  it("gives HO one row per location in scope, with zeros for a location with nothing", async () => {
    fake.answer = feedCounts;

    const breakdown = await getBreakdown(twoZones, "ho");

    expect(breakdown).toEqual({
      kind: "locations",
      rows: [
        { id: LOC_A, name: "Gudang Utara", workers: 10, pendingRequests: 1, draftRosters: 0, conflicts: 0 },
        { id: LOC_B, name: "Gudang Timur", workers: 5, pendingRequests: 2, draftRosters: 1, conflicts: 2 },
        { id: LOC_C, name: "Plant 1", workers: 0, pendingRequests: 0, draftRosters: 0, conflicts: 0 },
      ],
    });
    expect(callsOn(site)).toHaveLength(0);
  });

  it("gives admin site its latest three requests, newest first", async () => {
    const own: DashboardScope = {
      access: { siteId: SITE_A, locationId: LOC_A },
      locations: [twoZones.locations[0]],
      zones: [{ timezone: "Asia/Jakarta", today: "2026-11-09", locationIds: [LOC_A] }],
    };
    const rows = [
      { id: "r3", poNumber: "PO-NK-202611-0003", type: "weekly", startDate: "2026-11-16", status: "pending" },
      { id: "r2", poNumber: "PO-NK-202611-0002", type: "daily", startDate: "2026-11-10", status: "approved" },
      { id: "r1", poNumber: "PO-NK-202611-0001", type: "weekly", startDate: "2026-11-09", status: "approved" },
    ];

    fake.answer = (call: Call) => (call.table === rosterRequest ? rows : []);

    const breakdown = await getBreakdown(own, "admin_site");

    expect(breakdown).toEqual({ kind: "requests", rows });
    expect(calls()).toHaveLength(1);

    const [recent] = calls();
    expect(recent.table).toBe(rosterRequest);
    expect(render(recent.where)).toEqual({
      sql: '"roster_request"."location_id" in ($1)',
      params: [LOC_A],
    });
    expect(recent.orderBy?.map((term) => render(term).sql)).toEqual([
      '"roster_request"."created_at" desc',
      '"roster_request"."id" desc',
    ]);
    expect(recent.limit).toBe(3);
  });
});
