import { readFileSync } from "node:fs";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rosterRequestLine } from "@/database/schema/request-schema";
import { shift } from "@/database/schema/shift-schema";
import { SHIFT_IN_USE_MESSAGE, SHIFT_NOT_FOUND_MESSAGE } from "./shift-rules";

// The database is replaced by a recorder. Every query is logged as a Call. A select on the shift
// table returns the next entry of `targets`, and a select on the request lines returns the next
// entry of `statuses`, so a bulk delete can see a different answer for each shift. The recorder
// cannot run a WHERE clause, so the tests read the bound parameters instead.
type Call = {
  op: "select" | "update";
  table?: unknown;
  set?: Record<string, unknown>;
  lock?: string;
  where?: SQL;
};

const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  targets: [] as unknown[][],
  statuses: [] as unknown[][],
  access: { siteId: null } as { siteId: string | null },
}));

const dialect = new PgDialect();

function whereParams(where: SQL | undefined): unknown[] {
  return where ? dialect.sqlToQuery(where).params : [];
}

function result(call: Call): unknown {
  if (call.op === "select" && call.table === shift) return fake.targets.shift() ?? [];
  if (call.op === "select" && call.table === rosterRequestLine) return fake.statuses.shift() ?? [];

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
    for(strength: string) {
      call.lock = strength;
      return chain;
    },
    set(values: Record<string, unknown>) {
      call.set = values;
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
};

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("./shift-guard", () => ({ requireShiftManager: async () => fake.access }));
vi.mock("@/lib/db", () => ({
  db: { ...query, transaction: async (run: (tx: typeof query) => unknown) => run(query) },
}));

const { revalidatePath } = await import("next/cache");
const { deleteShift, deleteShifts } = await import("./actions");

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SHIFT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SHIFT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const status = (value: string) => ({ status: value });
const updates = () => fake.calls.filter((call) => call.op === "update");
const targetSelect = () =>
  fake.calls.find((call) => call.op === "select" && call.table === shift);
const usageSelects = () =>
  fake.calls.filter((call) => call.op === "select" && call.table === rosterRequestLine);

beforeEach(() => {
  fake.calls = [];
  fake.targets = [];
  fake.statuses = [];
  fake.access = { siteId: null };
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

  it("scopes the shift to the manager's site", async () => {
    fake.access = { siteId: SITE_A };
    fake.targets = [[{ id: SHIFT_A }]];

    await deleteShift(SHIFT_A);

    expect(whereParams(targetSelect()?.where)).toContain(SITE_A);
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
