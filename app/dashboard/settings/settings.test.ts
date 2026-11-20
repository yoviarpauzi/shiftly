import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { location } from "@/database/schema/location-schema";
import { workRule } from "@/database/schema/work-rule-schema";
import type { SettingsAccess, WorkRuleRow } from "@/types/settings";

// The database is replaced by a recorder. Each select is logged as a Call, and its rows come from
// `fake.rows`, keyed by the table in `.from(...)`. The recorder cannot run a WHERE or an ORDER BY,
// so the scoping and ordering contracts are pinned by rendering the recorded terms to SQL.
type Call = { table?: unknown; where?: SQL; orderBy?: SQL[] };

const fake = vi.hoisted(() => ({
  calls: [] as { table?: unknown; where?: unknown; orderBy?: unknown[] }[],
  rows: {
    location: [] as unknown[],
    global: null as unknown,
    locationRule: null as unknown,
  },
}));

const dialectForRows = new PgDialect();

// A work_rule read is answered by the scope its WHERE asks for, read from the rendered SQL.
function result(call: Call): unknown {
  if (call.table === location) return fake.rows.location;

  if (call.table === workRule) {
    const { params } = dialectForRows.sqlToQuery(call.where as SQL);
    const found = params[0] === "global" ? fake.rows.global : fake.rows.locationRule;

    return found ? [found] : [];
  }

  return [];
}

function builder(call: Call) {
  fake.calls.push(call);

  const chain = {
    from(table: unknown) {
      call.table = table;
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
      return new Promise((done) => done(result(call))).then(resolve, reject);
    },
  };

  return chain;
}

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
}));
vi.mock("@/lib/db", () => ({ db: { select: () => builder({}) } }));

const { settingsLocationChoiceFor, workRulesFor } = await import("./settings");

const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";

const HO: SettingsAccess = { userId: "user-2", role: "ho", locationId: null };
const ADMIN_SITE: SettingsAccess = {
  userId: "user-3",
  role: "admin_site",
  locationId: LOCATION_A,
};

const NOTHING_SET: WorkRuleRow = {
  workDaysPerWeek: null,
  breakDays: null,
  breakCycleMonths: null,
  annualOffDays: null,
  shiftExceptionDays: null,
  requirePositionMatch: null,
  keepPreviousPlacement: null,
  maxWorkingDaysPerMonth: null,
};
const row = (set: Partial<WorkRuleRow>): WorkRuleRow => ({ ...NOTHING_SET, ...set });

const dialect = new PgDialect();
const render = (query: unknown) => dialect.sqlToQuery(query as SQL);
const renderOrderBy = (call: (typeof fake.calls)[number]) =>
  ((call.orderBy ?? []) as SQL[]).map((term) => render(term).sql).join(", ");

beforeEach(() => {
  fake.calls = [];
  fake.rows = { location: [], global: null, locationRule: null };
});

describe("settingsLocationChoiceFor", () => {
  it("lists every active location for an HO, ordered by name then id", async () => {
    const rows = [
      { id: LOCATION_A, name: "North" },
      { id: LOCATION_B, name: "South" },
    ];

    fake.rows.location = rows;

    const choice = await settingsLocationChoiceFor(HO);

    expect(choice).toEqual({ mode: "pick", locations: rows });
    expect(fake.calls).toHaveLength(1);

    const [call] = fake.calls;

    expect(call.table).toBe(location);
    expect(render(call.where)).toMatchObject({
      sql: '"location"."deleted_at" is null',
      params: [],
    });
    expect(renderOrderBy(call)).toBe('"location"."name" asc, "location"."id" asc');
  });

  it("gives an admin site its own active location as fixed text", async () => {
    const own = { id: LOCATION_A, name: "North" };

    fake.rows.location = [own];

    const choice = await settingsLocationChoiceFor(ADMIN_SITE);

    expect(choice).toEqual({ mode: "fixed", location: own });
    expect(fake.calls).toHaveLength(1);

    const [call] = fake.calls;

    expect(call.table).toBe(location);
    expect(render(call.where)).toMatchObject({
      sql: '("location"."id" = $1 and "location"."deleted_at" is null)',
      params: [LOCATION_A],
    });
  });

  it("answers not found when the admin site's own location is no longer active", async () => {
    await expect(settingsLocationChoiceFor(ADMIN_SITE)).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
  });
});

describe("workRulesFor", () => {
  it("reads only the global row at global level, with no location lookup", async () => {
    fake.rows.global = row({ workDaysPerWeek: 7 });

    const rules = await workRulesFor({ scope: "global", locationId: null });

    expect(rules).toMatchObject({
      scope: "global",
      locationId: null,
      locationName: null,
      own: { workDaysPerWeek: true, breakDays: false },
    });
    expect(rules?.resolved.values.workDaysPerWeek).toBe(7);
    expect(rules?.resolved.sources.workDaysPerWeek).toBe("global");
    expect(fake.calls.map((call) => call.table)).toEqual([workRule]);
    expect(fake.calls.map((call) => render(call.where).params)).toEqual([["global"]]);
  });

  it("reads the global row and the location's row at location level", async () => {
    fake.rows.location = [{ id: LOCATION_A, name: "North" }];
    fake.rows.global = row({ workDaysPerWeek: 7 });
    fake.rows.locationRule = row({ breakDays: 2 });

    const rules = await workRulesFor({ scope: "location", locationId: LOCATION_A });

    expect(rules).toMatchObject({
      scope: "location",
      locationId: LOCATION_A,
      locationName: "North",
      own: { workDaysPerWeek: false, breakDays: true },
    });
    expect(rules?.resolved.values).toMatchObject({ workDaysPerWeek: 7, breakDays: 2 });
    expect(rules?.resolved.sources).toMatchObject({
      workDaysPerWeek: "global",
      breakDays: "location",
      annualOffDays: "default",
    });
    expect(fake.calls[0].table).toBe(location);
    expect(render(fake.calls[0].where)).toMatchObject({
      sql: '("location"."id" = $1 and "location"."deleted_at" is null)',
      params: [LOCATION_A],
    });
    expect(
      fake.calls.filter((call) => call.table === workRule).map((call) => render(call.where).params),
    ).toEqual([["global"], ["location", LOCATION_A]]);
  });

  it("lets a location with no row of its own inherit the global row", async () => {
    fake.rows.location = [{ id: LOCATION_A, name: "North" }];
    fake.rows.global = row({ workDaysPerWeek: 7, requirePositionMatch: false });

    const rules = await workRulesFor({ scope: "location", locationId: LOCATION_A });

    expect(rules?.resolved.values).toMatchObject({
      workDaysPerWeek: 7,
      requirePositionMatch: false,
    });
    expect(rules?.resolved.sources.workDaysPerWeek).toBe("global");
    expect(Object.values(rules!.own).some(Boolean)).toBe(false);
  });

  it("lets a null column at the location inherit global", async () => {
    fake.rows.location = [{ id: LOCATION_A, name: "North" }];
    fake.rows.global = row({ breakCycleMonths: 6 });
    fake.rows.locationRule = row({ breakCycleMonths: null });

    const rules = await workRulesFor({ scope: "location", locationId: LOCATION_A });

    expect(rules?.resolved.values.breakCycleMonths).toBe(6);
    expect(rules?.resolved.sources.breakCycleMonths).toBe("global");
    expect(rules?.own.breakCycleMonths).toBe(false);
  });

  it("is null when the location is not active", async () => {
    expect(await workRulesFor({ scope: "location", locationId: LOCATION_A })).toBeNull();
  });

  it("is null at location level without a location id", async () => {
    expect(await workRulesFor({ scope: "location", locationId: null })).toBeNull();
    expect(fake.calls).toEqual([]);
  });
});
