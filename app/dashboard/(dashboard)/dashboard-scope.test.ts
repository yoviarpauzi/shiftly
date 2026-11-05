import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { location } from "@/database/schema/location-schema";
import type { RequestAccess } from "@/types/requests";
import type { ScopeLocation } from "@/types/dashboard";

// The database is replaced by a recorder. Each select is logged as a Call, and its rows come from
// `fake.rows`. The recorder cannot run a WHERE or an ORDER BY, so the recorded where and orderBy
// are rendered to SQL and asserted as text.
type Call = {
  table?: unknown;
  joined?: unknown;
  where?: SQL;
  orderBy?: SQL[];
};

const fake = vi.hoisted(() => ({
  calls: [] as unknown[],
  rows: [] as unknown[],
}));

const dialect = new PgDialect();

function builder(call: Call) {
  fake.calls.push(call);

  const chain = {
    from(table: unknown) {
      call.table = table;
      return chain;
    },
    innerJoin(table: unknown) {
      call.joined = table;
      return chain;
    },
    where(condition: SQL) {
      call.where = condition;
      return chain;
    },
    orderBy(...terms: SQL[]) {
      call.orderBy = terms;
      return chain;
    },
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      return new Promise((done) => done(fake.rows)).then(resolve, reject);
    },
  };

  return chain;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: { select: () => builder({}) } }));

const { buildScope, dashboardScopeFor } = await import("./dashboard-scope");

const SITE_A = "11111111-1111-4111-8111-111111111111";
const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";
const LOCATION_C = "55555555-5555-4555-8555-555555555555";

const everything: RequestAccess = { siteId: null, locationId: null };

function scopeLocation(overrides: Partial<ScopeLocation>): ScopeLocation {
  return {
    id: LOCATION_A,
    name: "Gudang Utara",
    siteId: SITE_A,
    siteName: "Nestle Kejayan",
    timezone: "Asia/Jakarta",
    ...overrides,
  };
}

describe("buildScope", () => {
  // 16:30 UTC is 23:30 in WIB and 00:30 the next day in WITA.
  const now = new Date("2026-11-09T16:30:00Z");

  it("groups the locations by time zone, each zone with its own today", () => {
    const locations = [
      scopeLocation({ id: LOCATION_A, timezone: "Asia/Jakarta" }),
      scopeLocation({ id: LOCATION_B, timezone: "Asia/Makassar" }),
      scopeLocation({ id: LOCATION_C, timezone: "Asia/Jakarta" }),
    ];

    const scope = buildScope(everything, locations, now);

    expect(scope.access).toBe(everything);
    expect(scope.locations).toEqual(locations);
    expect(scope.zones).toEqual([
      { timezone: "Asia/Jakarta", today: "2026-11-09", locationIds: [LOCATION_A, LOCATION_C] },
      { timezone: "Asia/Makassar", today: "2026-11-10", locationIds: [LOCATION_B] },
    ]);
  });

  it("keeps the zones in the order their first location appears", () => {
    const scope = buildScope(
      everything,
      [
        scopeLocation({ id: LOCATION_B, timezone: "Asia/Makassar" }),
        scopeLocation({ id: LOCATION_A, timezone: "Asia/Jakarta" }),
      ],
      now,
    );

    expect(scope.zones.map((zone) => zone.timezone)).toEqual(["Asia/Makassar", "Asia/Jakarta"]);
  });

  it("gives no zones when there are no locations", () => {
    expect(buildScope(everything, [], now)).toEqual({
      access: everything,
      locations: [],
      zones: [],
    });
  });
});

describe("dashboardScopeFor", () => {
  beforeEach(() => {
    fake.calls.length = 0;
    fake.rows = [];
  });

  function recorded() {
    expect(fake.calls).toHaveLength(1);

    const call = fake.calls[0] as Call;
    const where = dialect.sqlToQuery(call.where as SQL);
    const orderBy = (call.orderBy ?? []).map((term) => dialect.sqlToQuery(term).sql);

    return { call, where, orderBy };
  }

  it("reads the active locations joined to their active site, ordered by site, location, id", async () => {
    await dashboardScopeFor(everything);

    const { call, where, orderBy } = recorded();

    expect(call.table).toBe(location);
    expect(call.joined).toBeDefined();
    expect(where.sql).toContain('"location"."deleted_at" is null');
    expect(where.sql).toContain('"site"."deleted_at" is null');
    expect(orderBy).toEqual(['"site"."name" asc', '"location"."name" asc', '"location"."id" asc']);
  });

  it("adds no site or location condition for a superadmin", async () => {
    await dashboardScopeFor(everything);

    const { where } = recorded();

    expect(where.sql).not.toContain('"location"."site_id"');
    expect(where.sql).not.toContain('"location"."id"');
    expect(where.params).toEqual([]);
  });

  it("limits an HO to the locations of its site", async () => {
    await dashboardScopeFor({ siteId: SITE_A, locationId: null });

    const { where } = recorded();

    expect(where.sql).toContain('"location"."site_id" = $1');
    expect(where.sql).not.toContain('"location"."id" =');
    expect(where.params).toEqual([SITE_A]);
  });

  it("limits an admin site to its own location", async () => {
    await dashboardScopeFor({ siteId: SITE_A, locationId: LOCATION_A });

    const { where } = recorded();

    expect(where.sql).toContain('"location"."id" = ');
    expect(where.params).toContain(LOCATION_A);
  });

  it("returns the rows as a scope with zones", async () => {
    fake.rows = [scopeLocation({ id: LOCATION_A }), scopeLocation({ id: LOCATION_B })];

    const scope = await dashboardScopeFor(everything);

    expect(scope.access).toBe(everything);
    expect(scope.locations).toHaveLength(2);
    expect(scope.zones).toHaveLength(1);
    expect(scope.zones[0].locationIds).toEqual([LOCATION_A, LOCATION_B]);
  });
});
