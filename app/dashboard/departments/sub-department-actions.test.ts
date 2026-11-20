import { readFileSync } from "node:fs";
import { type SQL, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { department, subDepartment } from "@/database/schema/department-schema";
import {
  DEPARTMENT_NOT_FOUND_MESSAGE,
  SUB_DEPARTMENT_NOT_FOUND_MESSAGE,
} from "./department-rules";

// The database is replaced by a recorder. Every query is logged as a Call. A select on the
// department or sub-department table returns the next entry of `parents`. The recorder cannot run
// a WHERE clause, so a row the select does not return stands for a row outside the caller's scope,
// and the tests read the bound parameters to prove the location id sits in each statement. A select
// used as a subquery is recorded too, which is how the parent check inside the child write is seen.
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
  parents: [] as unknown[][],
  access: { locationId: null } as { locationId: string | null },
}));

const dialect = new PgDialect();

function whereParams(where: SQL | undefined): unknown[] {
  return where ? dialect.sqlToQuery(where).params : [];
}

function result(call: Call): unknown {
  // The lock read of an update, delete or restore starts from the sub-department and joins its
  // department. Creating reads the department alone. Both take the next entry of `parents`. A
  // select used as a subquery is never awaited, so it never reaches here.
  if (call.op === "select" && call.table === subDepartment) return fake.parents.shift() ?? [];
  if (call.op === "select" && call.table === department) return fake.parents.shift() ?? [];
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
    // Lets the recorder stand in for a subquery inside inArray().
    getSQL: () => sql`(select 1)`,
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
  createSubDepartment,
  deleteSubDepartment,
  deleteSubDepartments,
  restoreSubDepartment,
  updateSubDepartment,
} = await import("./sub-department-actions");

const LOCATION_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const DEPARTMENT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEPARTMENT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SUB_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const SUB_B = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const updates = () => fake.calls.filter((call) => call.op === "update");
const inserts = () => fake.calls.filter((call) => call.op === "insert");
const selects = () => fake.calls.filter((call) => call.op === "select");

// The first select is the lock read the action makes. A later select on the department table is the
// parent check nested inside the child write.
const lockRead = () => selects()[0];
const parentCheck = () => selects().find((call, index) => index > 0 && call.table === department);

beforeEach(() => {
  fake.calls = [];
  fake.parents = [];
  fake.access = { locationId: null };
  vi.mocked(revalidatePath).mockClear();
});

// The actions module depends on the database, so the directive is checked by reading the file.
// The directive is what makes its exports server actions.
describe("sub-department actions module", () => {
  it("opens with the use server directive so client components can call it", () => {
    const source = readFileSync(new URL("./sub-department-actions.ts", import.meta.url), "utf8");

    expect(source.split("\n")[0].trim()).toBe('"use server";');
  });
});

describe("admin site manager and a sub-department of another location", () => {
  beforeEach(() => {
    fake.access = { locationId: LOCATION_A };
  });

  it("createSubDepartment reads a parent outside the location as missing, and inserts nothing", async () => {
    const res = await createSubDepartment(DEPARTMENT_B, { name: "Line 1" });

    expect(res).toEqual({ ok: false, formError: DEPARTMENT_NOT_FOUND_MESSAGE });
    expect(whereParams(lockRead().where)).toEqual(
      expect.arrayContaining([DEPARTMENT_B, LOCATION_A]),
    );
    expect(lockRead().lock).toBe("share");
    expect(inserts()).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("createSubDepartment inserts under a parent in the location", async () => {
    fake.parents = [[{ id: DEPARTMENT_A }]];

    const res = await createSubDepartment(DEPARTMENT_A, { name: "Line 1" });

    expect(res).toEqual({ ok: true });
    expect(inserts()).toHaveLength(1);
    expect(inserts()[0].values).toEqual({ name: "Line 1", departmentId: DEPARTMENT_A });
  });

  it("updateSubDepartment reads a child outside the location as missing, and writes nothing", async () => {
    const res = await updateSubDepartment(SUB_B, { name: "Line 2" });

    expect(res).toEqual({ ok: false, formError: SUB_DEPARTMENT_NOT_FOUND_MESSAGE });
    expect(whereParams(lockRead().where)).toEqual(expect.arrayContaining([SUB_B, LOCATION_A]));
    expect(updates()).toEqual([]);
  });

  it("updateSubDepartment repeats the location condition on the write through the parent", async () => {
    fake.parents = [[{ id: SUB_A, departmentId: DEPARTMENT_A }]];

    const res = await updateSubDepartment(SUB_A, { name: "Line 2" });

    expect(res).toEqual({ ok: true });
    expect(updates()).toHaveLength(1);
    expect(updates()[0].table).toBe(subDepartment);
    expect(whereParams(parentCheck()?.where)).toContain(LOCATION_A);
  });

  it("deleteSubDepartment reads a child outside the location as missing, and writes nothing", async () => {
    const res = await deleteSubDepartment(SUB_B);

    expect(res).toEqual({ ok: false, formError: SUB_DEPARTMENT_NOT_FOUND_MESSAGE });
    expect(whereParams(lockRead().where)).toEqual(expect.arrayContaining([SUB_B, LOCATION_A]));
    expect(updates()).toEqual([]);
  });

  it("deleteSubDepartment repeats the location condition on the write through the parent", async () => {
    fake.parents = [[{ id: SUB_A, departmentId: DEPARTMENT_A }]];

    const res = await deleteSubDepartment(SUB_A);

    expect(res).toEqual({ ok: true });
    expect(updates()[0].set?.deletedAt).toBeInstanceOf(Date);
    expect(whereParams(parentCheck()?.where)).toContain(LOCATION_A);
  });

  it("deleteSubDepartments blocks every child outside the location", async () => {
    const res = await deleteSubDepartments([SUB_A, SUB_B]);

    expect(res).toEqual({
      deletedIds: [],
      blocked: [
        { id: SUB_A, formError: SUB_DEPARTMENT_NOT_FOUND_MESSAGE },
        { id: SUB_B, formError: SUB_DEPARTMENT_NOT_FOUND_MESSAGE },
      ],
    });
    expect(updates()).toEqual([]);
  });

  it("restoreSubDepartment reads a child outside the location as missing, and writes nothing", async () => {
    const res = await restoreSubDepartment(SUB_B);

    expect(res).toEqual({ ok: false, formError: SUB_DEPARTMENT_NOT_FOUND_MESSAGE });
    expect(whereParams(lockRead().where)).toEqual(expect.arrayContaining([SUB_B, LOCATION_A]));
    expect(updates()).toEqual([]);
  });

  it("restoreSubDepartment repeats the location condition on the write through the parent", async () => {
    fake.parents = [[{ id: SUB_A, departmentId: DEPARTMENT_A, departmentDeletedAt: null }]];

    const res = await restoreSubDepartment(SUB_A);

    expect(res).toEqual({ ok: true });
    expect(updates()[0].set).toEqual({ deletedAt: null });
    expect(whereParams(parentCheck()?.where)).toContain(LOCATION_A);
  });
});

describe("HO manager and sub-departments", () => {
  it("adds no location condition when it deletes a sub-department", async () => {
    fake.parents = [[{ id: SUB_A, departmentId: DEPARTMENT_A }]];

    const res = await deleteSubDepartment(SUB_A);

    expect(res).toEqual({ ok: true });
    expect(whereParams(lockRead().where)).toEqual([SUB_A]);
    expect(whereParams(parentCheck()?.where)).not.toContain(LOCATION_A);
  });
});
