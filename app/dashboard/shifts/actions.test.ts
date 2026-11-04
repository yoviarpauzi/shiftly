import { readFileSync } from "node:fs";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { location } from "@/database/schema/location-schema";
import { rosterRequestLine } from "@/database/schema/request-schema";
import { shift } from "@/database/schema/shift-schema";
import {
  LOCATION_DELETED_MESSAGE,
  LOCATION_NOT_FOUND_MESSAGE,
  SHIFT_IN_USE_MESSAGE,
  SHIFT_NOT_FOUND_MESSAGE,
} from "./shift-rules";

// The database is replaced by a recorder. Every query is logged as a Call. A select on the shift
// table returns the next entry of `targets`, a select on the location table returns the next entry
// of `locations`, and a select on the request lines returns the next entry of `statuses`, so a bulk
// delete can see a different answer for each shift. The recorder
// cannot run a WHERE clause, so the tests read the bound parameters instead.
type Call = {
  op: "select" | "update" | "insert";
  table?: unknown;
  set?: Record<string, unknown>;
  values?: Record<string, unknown>;
  lock?: string;
  returning?: boolean;
  where?: SQL;
};

const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  targets: [] as unknown[][],
  locations: [] as unknown[][],
  statuses: [] as unknown[][],
  access: { siteId: null, locationId: null } as {
    siteId: string | null;
    locationId: string | null;
  },
}));

const dialect = new PgDialect();

function whereParams(where: SQL | undefined): unknown[] {
  return where ? dialect.sqlToQuery(where).params : [];
}

function result(call: Call): unknown {
  if (call.op === "select" && call.table === shift) return fake.targets.shift() ?? [];
  if (call.op === "select" && call.table === location) return fake.locations.shift() ?? [];
  if (call.op === "select" && call.table === rosterRequestLine) return fake.statuses.shift() ?? [];

  // An update that asks for its rows back reports the one row it changed.
  if (call.op === "update" && call.returning) return [{ id: "changed" }];

  return [];
}

function builder(call: Call) {
  fake.calls.push(call);

  const chain = {
    from(table: unknown) {
      call.table = table;
      return chain;
    },
    innerJoin: () => chain,
    where(where: SQL) {
      call.where = where;
      return chain;
    },
    groupBy: () => chain,
    returning() {
      call.returning = true;
      return chain;
    },
    for(strength: string) {
      call.lock = strength;
      return chain;
    },
    set(values: Record<string, unknown>) {
      call.set = values;
      return chain;
    },
    values(values: Record<string, unknown>) {
      call.values = values;
      return chain;
    },
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      return new Promise((done) => done(result(call))).then(resolve, reject);
    },
  };

  return chain;
}

const query = {
  select: () => builder({ op: "select" }),
  update: (table: unknown) => builder({ op: "update", table }),
  insert: (table: unknown) => builder({ op: "insert", table }),
};

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("./shift-guard", () => ({ requireShiftManager: async () => fake.access }));
vi.mock("@/lib/db", () => ({
  db: { ...query, transaction: async (run: (tx: typeof query) => unknown) => run(query) },
}));

const { revalidatePath } = await import("next/cache");
const { createShift, deleteShift, deleteShifts, restoreShift } = await import("./actions");

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SHIFT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SHIFT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const status = (value: string) => ({ status: value });
const updates = () => fake.calls.filter((call) => call.op === "update");
const inserts = () => fake.calls.filter((call) => call.op === "insert");
const locationSelect = () =>
  fake.calls.find((call) => call.op === "select" && call.table === location);
const targetSelect = () =>
  fake.calls.find((call) => call.op === "select" && call.table === shift);
const usageSelects = () =>
  fake.calls.filter((call) => call.op === "select" && call.table === rosterRequestLine);

beforeEach(() => {
  fake.calls = [];
  fake.targets = [];
  fake.locations = [];
  fake.statuses = [];
  fake.access = { siteId: null, locationId: null };
  vi.mocked(revalidatePath).mockClear();
});

// The actions module depends on the database, so the directive is checked by reading the file.
// The directive is what makes its exports server actions.
describe("shift actions module", () => {
  it("opens with the use server directive so client components can call it", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

    expect(source.split("\n")[0].trim()).toBe('"use server";');
  });
});

describe("deleteShift", () => {
  it("locks the shift row for update before it reads who uses the shift", async () => {
    fake.targets = [[{ id: SHIFT_A }]];

    await deleteShift(SHIFT_A);

    expect(targetSelect()?.lock).toBe("update");
    expect(fake.calls.indexOf(targetSelect() as Call)).toBeLessThan(
      fake.calls.indexOf(usageSelects()[0]),
    );
  });

  it("scopes the shift to the site's locations for an HO manager", async () => {
    fake.access = { siteId: SITE_A, locationId: null };
    fake.targets = [[{ id: SHIFT_A }]];

    await deleteShift(SHIFT_A);

    expect(whereParams(targetSelect()?.where)).toContain(SITE_A);
  });

  it("scopes the shift to the one location for an admin site manager", async () => {
    fake.access = { siteId: null, locationId: LOCATION_A };
    fake.targets = [[{ id: SHIFT_A }]];

    await deleteShift(SHIFT_A);

    expect(whereParams(targetSelect()?.where)).toContain(LOCATION_A);
  });

  it("refuses a shift that is not found, and reads no usage and writes nothing", async () => {
    const res = await deleteShift(SHIFT_A);

    expect(res).toEqual({ ok: false, formError: SHIFT_NOT_FOUND_MESSAGE });
    expect(usageSelects()).toEqual([]);
    expect(updates()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["pending", "approved"])(
    "refuses a shift a %s request uses, and writes nothing",
    async (used) => {
      fake.targets = [[{ id: SHIFT_A }]];
      fake.statuses = [[status("rejected"), status(used)]];

      const res = await deleteShift(SHIFT_A);

      expect(res).toEqual({ ok: false, formError: SHIFT_IN_USE_MESSAGE });
      expect(updates()).toEqual([]);
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("asks which requests use this shift", async () => {
    fake.targets = [[{ id: SHIFT_A }]];

    await deleteShift(SHIFT_A);

    expect(whereParams(usageSelects()[0].where)).toEqual([SHIFT_A]);
  });

  it("deletes a shift only rejected and cancelled requests use", async () => {
    fake.targets = [[{ id: SHIFT_A }]];
    fake.statuses = [[status("rejected"), status("cancelled")]];

    const res = await deleteShift(SHIFT_A);

    expect(res).toEqual({ ok: true });
    expect(updates()).toHaveLength(1);
    expect(updates()[0].table).toBe(shift);
    expect(updates()[0].set?.deletedAt).toBeInstanceOf(Date);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/shifts");
  });

  it("deletes a shift no request uses", async () => {
    fake.targets = [[{ id: SHIFT_A }]];

    expect(await deleteShift(SHIFT_A)).toEqual({ ok: true });
    expect(updates()).toHaveLength(1);
  });
});

describe("deleteShifts", () => {
  it("checks each shift on its own, so one can be deleted while another is blocked", async () => {
    fake.targets = [[{ id: SHIFT_A }], [{ id: SHIFT_B }]];
    fake.statuses = [[], [status("pending")]];

    const res = await deleteShifts([SHIFT_A, SHIFT_B]);

    expect(res).toEqual({
      deletedIds: [SHIFT_A],
      blocked: [{ id: SHIFT_B, formError: SHIFT_IN_USE_MESSAGE }],
    });
    expect(updates()).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("does not revalidate when every shift is blocked", async () => {
    fake.targets = [[{ id: SHIFT_A }]];
    fake.statuses = [[status("approved")]];

    const res = await deleteShifts([SHIFT_A]);

    expect(res.deletedIds).toEqual([]);
    expect(res.blocked).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

const shiftInput = {
  locationId: LOCATION_A,
  order: 1,
  name: "Morning",
  startTime: "06:00",
  endTime: "14:00",
};

describe("createShift", () => {
  it("refuses a location the select does not return, and writes nothing", async () => {
    const res = await createShift(shiftInput);

    expect(res).toEqual({ ok: false, formError: LOCATION_NOT_FOUND_MESSAGE });
    expect(inserts()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a location of another site for an HO manager, and writes nothing", async () => {
    fake.access = { siteId: SITE_A, locationId: null };
    fake.locations = [[{ id: LOCATION_A, siteId: SITE_B }]];

    const res = await createShift(shiftInput);

    expect(res).toEqual({ ok: false, formError: LOCATION_NOT_FOUND_MESSAGE });
    expect(inserts()).toEqual([]);
  });

  it("refuses a location other than the admin site manager's own", async () => {
    fake.access = { siteId: null, locationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" };
    fake.locations = [[{ id: LOCATION_A, siteId: SITE_A }]];

    const res = await createShift(shiftInput);

    expect(res).toEqual({ ok: false, formError: LOCATION_NOT_FOUND_MESSAGE });
    expect(inserts()).toEqual([]);
  });

  it("reads the location under a share lock", async () => {
    fake.locations = [[{ id: LOCATION_A, siteId: SITE_A }]];

    await createShift(shiftInput);

    expect(locationSelect()?.lock).toBe("share");
  });

  it("inserts the location id, not a site id", async () => {
    fake.access = { siteId: SITE_A, locationId: null };
    fake.locations = [[{ id: LOCATION_A, siteId: SITE_A }]];

    const res = await createShift(shiftInput);

    expect(res).toEqual({ ok: true });
    expect(inserts()).toHaveLength(1);
    expect(inserts()[0].table).toBe(shift);
    expect(inserts()[0].values).toMatchObject({ locationId: LOCATION_A, name: "Morning" });
    expect(inserts()[0].values).not.toHaveProperty("siteId");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/shifts");
  });
});

describe("restoreShift", () => {
  it("is blocked while the location is deleted, and writes nothing", async () => {
    fake.targets = [[{ id: SHIFT_A, locationId: LOCATION_A }]];
    fake.locations = [[{ deletedAt: new Date() }]];

    const res = await restoreShift(SHIFT_A);

    expect(res).toEqual({ ok: false, formError: LOCATION_DELETED_MESSAGE });
    expect(updates()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("restores a shift whose location is active", async () => {
    fake.targets = [[{ id: SHIFT_A, locationId: LOCATION_A }]];
    fake.locations = [[{ deletedAt: null }]];

    const res = await restoreShift(SHIFT_A);

    expect(res).toEqual({ ok: true });
    expect(updates()).toHaveLength(1);
    expect(updates()[0].set).toEqual({ deletedAt: null });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/shifts");
  });

  it("reads the location under a share lock", async () => {
    fake.targets = [[{ id: SHIFT_A, locationId: LOCATION_A }]];
    fake.locations = [[{ deletedAt: null }]];

    await restoreShift(SHIFT_A);

    expect(locationSelect()?.lock).toBe("share");
    expect(whereParams(locationSelect()?.where)).toEqual([LOCATION_A]);
  });
});
