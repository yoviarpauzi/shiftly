import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { location } from "@/database/schema/location-schema";
import { site } from "@/database/schema/site-schema";
import type { SettingsAccess } from "@/types/settings";

// The database is replaced by a recorder. Each select is logged as a Call, and its rows come from
// `fake.rows`, keyed by the table in `.from(...)`. The recorder cannot run a WHERE or an ORDER BY,
// so the scoping and ordering contracts are pinned by rendering the recorded terms to SQL.
type Call = { table?: unknown; where?: SQL; orderBy?: SQL[] };

const fake = vi.hoisted(() => ({
  calls: [] as { table?: unknown; where?: unknown; orderBy?: unknown[] }[],
  rows: { site: [] as unknown[], location: [] as unknown[] },
}));

function result(call: Call): unknown {
  if (call.table === site) return fake.rows.site;
  if (call.table === location) return fake.rows.location;
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

const { settingsLocationChoiceFor, settingsSiteChoiceFor } = await import("./settings");

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION_A = "33333333-3333-4333-8333-333333333333";

const SUPERADMIN: SettingsAccess = {
  userId: "user-1",
  role: "superadmin",
  siteId: null,
  locationId: null,
};
const HO: SettingsAccess = { userId: "user-2", role: "ho", siteId: SITE_A, locationId: null };
const ADMIN_SITE: SettingsAccess = {
  userId: "user-3",
  role: "admin_site",
  siteId: SITE_A,
  locationId: LOCATION_A,
};

const dialect = new PgDialect();
const render = (query: unknown) => dialect.sqlToQuery(query as SQL);
const renderOrderBy = (call: (typeof fake.calls)[number]) =>
  ((call.orderBy ?? []) as SQL[]).map((term) => render(term).sql).join(", ");

beforeEach(() => {
  fake.calls = [];
  fake.rows = { site: [], location: [] };
});

describe("settingsSiteChoiceFor", () => {
  it("lists the active sites for a superadmin, ordered by name then id", async () => {
    fake.rows.site = [{ id: SITE_A, name: "Alpha" }];

    const choice = await settingsSiteChoiceFor(SUPERADMIN);

    expect(choice).toEqual({ mode: "pick", sites: [{ id: SITE_A, name: "Alpha" }] });
    expect(fake.calls).toHaveLength(1);

    const [call] = fake.calls;

    expect(call.table).toBe(site);
    expect(render(call.where)).toMatchObject({ sql: '"site"."deleted_at" is null', params: [] });
    expect(renderOrderBy(call)).toBe('"site"."name" asc, "site"."id" asc');
  });

  it.each([
    ["an HO", HO],
    ["an admin site", ADMIN_SITE],
  ])("gives %s its own active site as fixed text", async (_, access) => {
    fake.rows.site = [{ id: SITE_A, name: "Alpha" }];

    const choice = await settingsSiteChoiceFor(access);

    expect(choice).toEqual({ mode: "fixed", site: { id: SITE_A, name: "Alpha" } });
    expect(fake.calls).toHaveLength(1);

    const [call] = fake.calls;

    expect(call.table).toBe(site);
    expect(render(call.where)).toMatchObject({
      sql: '("site"."id" = $1 and "site"."deleted_at" is null)',
      params: [SITE_A],
    });
  });

  it("answers not found when the HO's own site is no longer active", async () => {
    await expect(settingsSiteChoiceFor(HO)).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

describe("settingsLocationChoiceFor", () => {
  it.each([
    ["a superadmin", SUPERADMIN, SITE_B],
    ["an HO for its own site", HO, SITE_A],
  ])(
    "lists the active locations of the chosen site for %s, ordered by name then id",
    async (_, access, siteId) => {
      const rows = [{ id: LOCATION_A, name: "North", siteId }];

      fake.rows.location = rows;

      const choice = await settingsLocationChoiceFor(access, siteId);

      expect(choice).toEqual({ mode: "pick", locations: rows });
      expect(fake.calls).toHaveLength(1);

      const [call] = fake.calls;

      expect(call.table).toBe(location);
      expect(render(call.where)).toMatchObject({
        sql: '("location"."site_id" = $1 and "location"."deleted_at" is null)',
        params: [siteId],
      });
      expect(renderOrderBy(call)).toBe('"location"."name" asc, "location"."id" asc');
    },
  );

  it("gives an HO no locations for another site and runs no query", async () => {
    fake.rows.location = [{ id: LOCATION_A, name: "North", siteId: SITE_B }];

    const choice = await settingsLocationChoiceFor(HO, SITE_B);

    expect(choice).toEqual({ mode: "pick", locations: [] });
    expect(fake.calls).toHaveLength(0);
  });

  it.each([SITE_A, SITE_B])(
    "gives an admin site its own active location as fixed text (site %s asked)",
    async (siteId) => {
      const own = { id: LOCATION_A, name: "North", siteId: SITE_A };

      fake.rows.location = [own];

      const choice = await settingsLocationChoiceFor(ADMIN_SITE, siteId);

      expect(choice).toEqual({ mode: "fixed", location: own });
      expect(fake.calls).toHaveLength(1);

      const [call] = fake.calls;

      expect(call.table).toBe(location);
      expect(render(call.where)).toMatchObject({
        sql: '("location"."id" = $1 and "location"."deleted_at" is null)',
        params: [LOCATION_A],
      });
    },
  );

  it("answers not found when the admin site's own location is no longer active", async () => {
    await expect(settingsLocationChoiceFor(ADMIN_SITE, SITE_A)).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
  });
});
