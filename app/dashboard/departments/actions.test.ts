import { readFileSync } from "node:fs";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { department, subDepartment } from "@/database/schema/department-schema";
import { location } from "@/database/schema/location-schema";
import { DEPARTMENT_NOT_FOUND_MESSAGE } from "./department-rules";

// The database is replaced by a recorder. Every query is logged as a Call. A select on the
// department table returns the next entry of `departments`, a select on the location table returns
// the next entry of `locations`, and a select on the sub-department table returns the next entry of
// `subCounts`. The recorder cannot run a WHERE clause, so a row the select does not return stands
// for a row outside the caller's scope, and the tests read the bound parameters to prove the
// location id sits in the statement.
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
  departments: [] as unknown[][],
  locations: [] as unknown[][],
  subCounts: [] as unknown[][],
  access: { locationId: null } as { locationId: string | null },
}));

const dialect = new PgDialect();

function whereParams(where: SQL | undefined): unknown[] {
  return where ? dialect.sqlToQuery(where).params : [];
}

function result(call: Call): unknown {
  if (call.op === "select" && call.table === department) return fake.departments.shift() ?? [];
  if (call.op === "select" && call.table === location) return fake.locations.shift() ?? [];
  if (call.op === "select" && call.table === subDepartment) return fake.subCounts.shift() ?? [];

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
vi.mock("./department-guard", () => ({ requireDepartmentManager: async () => fake.access }));
vi.mock("@/lib/db", () => ({
  db: { ...query, transaction: async (run: (tx: typeof query) => unknown) => run(query) },
}));

const { revalidatePath } = await import("next/cache");
const {
  createDepartment,
  deleteDepartment,
  deleteDepartments,
  restoreDepartment,
  updateDepartment,
} = await import("./actions");

const LOCATION_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LOCATION_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const DEPARTMENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEPARTMENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const updates = () => fake.calls.filter((call) => call.op === "update");
const inserts = () => fake.calls.filter((call) => call.op === "insert");
const departmentSelect = () =>
  fake.calls.find((call) => call.op === "select" && call.table === department);

beforeEach(() => {
  fake.calls = [];
  fake.departments = [];
  fake.locations = [];
  fake.subCounts = [];
  fake.access = { locationId: null };
  vi.mocked(revalidatePath).mockClear();
});

// The actions module depends on the database, so the directive is checked by reading the file.
// The directive is what makes its exports server actions.
describe("department actions module", () => {
  it("opens with the use server directive so client components can call it", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

    expect(source.split("\n")[0].trim()).toBe('"use server";');
  });
});

describe("createDepartment", () => {
  const input = { name: "Packing", locationId: LOCATION_A };

  it("lets an HO manager create in any location", async () => {
    fake.locations = [[{ id: LOCATION_B }]];

    const res = await createDepartment({ ...input, locationId: LOCATION_B });

    expect(res).toEqual({ ok: true });
    expect(inserts()).toHaveLength(1);
    expect(inserts()[0].values).toEqual({ name: "Packing", locationId: LOCATION_B });
    expect(inserts()[0].values).not.toHaveProperty("siteId");
  });

  it("lets an admin site manager create in its own location", async () => {
    fake.access = { locationId: LOCATION_A };
    fake.locations = [[{ id: LOCATION_A }]];

    expect(await createDepartment(input)).toEqual({ ok: true });
    expect(inserts()).toHaveLength(1);
  });

  it("refuses another location for an admin site manager, and writes nothing", async () => {
    fake.access = { locationId: LOCATION_A };
    fake.locations = [[{ id: LOCATION_B }]];

    const res = await createDepartment({ ...input, locationId: LOCATION_B });

    expect(res).toEqual({ ok: false, formError: "Location not found" });
    expect(inserts()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a location the select does not return, and writes nothing", async () => {
    const res = await createDepartment(input);

    expect(res).toEqual({ ok: false, formError: "Location not found" });
    expect(inserts()).toEqual([]);
  });
});

describe("admin site manager and another location's department", () => {
  beforeEach(() => {
    fake.access = { locationId: LOCATION_A };
  });

  it("updateDepartment binds the manager's location in the update", async () => {
    await updateDepartment(DEPARTMENT_B, { name: "Packing" });

    expect(updates()).toHaveLength(1);
    expect(whereParams(updates()[0].where)).toEqual(
      expect.arrayContaining([DEPARTMENT_B, LOCATION_A]),
    );
  });

  it("deleteDepartment reads a department outside the location as missing, and writes nothing", async () => {
    const res = await deleteDepartment(DEPARTMENT_B);

    expect(res).toEqual({ ok: false, formError: DEPARTMENT_NOT_FOUND_MESSAGE });
    expect(whereParams(departmentSelect()?.where)).toEqual(
      expect.arrayContaining([DEPARTMENT_B, LOCATION_A]),
    );
    expect(updates()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("deleteDepartment binds the manager's location in the delete write too", async () => {
    fake.departments = [[{ id: DEPARTMENT_A }]];
    fake.subCounts = [[{ value: 0 }]];

    const res = await deleteDepartment(DEPARTMENT_A);

    expect(res).toEqual({ ok: true });
    expect(updates()).toHaveLength(1);
    expect(whereParams(updates()[0].where)).toEqual(
      expect.arrayContaining([DEPARTMENT_A, LOCATION_A]),
    );
  });

  it("deleteDepartments blocks every department outside the location", async () => {
    const res = await deleteDepartments([DEPARTMENT_A, DEPARTMENT_B]);

    expect(res).toEqual({
      deletedIds: [],
      blocked: [
        { id: DEPARTMENT_A, formError: DEPARTMENT_NOT_FOUND_MESSAGE },
        { id: DEPARTMENT_B, formError: DEPARTMENT_NOT_FOUND_MESSAGE },
      ],
    });
    expect(updates()).toEqual([]);
  });

  it("restoreDepartment reads a department outside the location as missing, and writes nothing", async () => {
    const res = await restoreDepartment(DEPARTMENT_B);

    expect(res).toEqual({ ok: false, formError: DEPARTMENT_NOT_FOUND_MESSAGE });
    expect(whereParams(departmentSelect()?.where)).toEqual(
      expect.arrayContaining([DEPARTMENT_B, LOCATION_A]),
    );
    expect(updates()).toEqual([]);
  });

  it("restoreDepartment binds the manager's location in the restore write too", async () => {
    fake.departments = [[{ id: DEPARTMENT_A, locationDeletedAt: null }]];

    const res = await restoreDepartment(DEPARTMENT_A);

    expect(res).toEqual({ ok: true });
    expect(whereParams(updates()[0].where)).toEqual(
      expect.arrayContaining([DEPARTMENT_A, LOCATION_A]),
    );
  });
});

describe("HO manager and departments", () => {
  it("adds no location condition when it deletes a department", async () => {
    fake.departments = [[{ id: DEPARTMENT_A }]];
    fake.subCounts = [[{ value: 0 }]];

    const res = await deleteDepartment(DEPARTMENT_A);

    expect(res).toEqual({ ok: true });
    expect(whereParams(departmentSelect()?.where)).toEqual([DEPARTMENT_A]);
  });
});
