import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { location } from "@/database/schema/location-schema";
import { position } from "@/database/schema/position-schema";
import { worker, workerPosition } from "@/database/schema/worker-schema";
import type { WorkerAccess } from "@/types/workers";

// The database is replaced by a recorder. Every query is logged as a Call, and the result of a
// read comes from `rows`, keyed by the table it reads. The recorder cannot run a WHERE clause, so
// a missing target is simulated by leaving its rows empty.
type Call = {
  op: "select" | "insert" | "update" | "delete";
  table?: unknown;
  values?: unknown;
  set?: Record<string, unknown>;
  lock?: string;
};

const fake = vi.hoisted(() => ({
  calls: [] as Call[],
  rows: {
    location: [] as unknown[],
    position: [] as unknown[],
    worker: [] as unknown[],
  },
  access: null as unknown,
}));

function result(call: Call): unknown {
  if (call.op === "select") {
    if (call.table === location) return fake.rows.location;
    if (call.table === position) return fake.rows.position;
    if (call.table === worker) return fake.rows.worker;
    return [];
  }

  if (call.op === "insert" && call.table === worker) return [{ id: WORKER_NEW }];
  if (call.op === "update" && call.table === worker) return [{ id: WORKER_ID }];

  return [];
}

function builder(call: Call) {
  fake.calls.push(call);

  const chain = {
    from(table: unknown) {
      call.table = table;
      return chain;
    },
    where: () => chain,
    returning: () => chain,
    for(strength: string) {
      call.lock = strength;
      return chain;
    },
    values(values: unknown) {
      call.values = values;
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

const tx = {
  select: () => builder({ op: "select" }),
  insert: (table: unknown) => builder({ op: "insert", table }),
  update: (table: unknown) => builder({ op: "update", table }),
  delete: (table: unknown) => builder({ op: "delete", table }),
};

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./worker-guard", () => ({
  requireWorkerManager: async () => fake.access,
}));
vi.mock("@/lib/db", () => ({
  db: { ...tx, transaction: async (run: (t: typeof tx) => unknown) => run(tx) },
}));

const { createWorker, deleteWorker, restoreWorker, updateWorker } = await import("./actions");

const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";
const POSITION_A = "88888888-8888-4888-8888-888888888888";
const WORKER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WORKER_NEW = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const ho: WorkerAccess = { locationId: null };

const input = {
  employeeId: "EMP-001",
  name: "Budi Santoso",
  locationId: LOCATION_A,
  positionIds: [POSITION_A],
  endContract: " 2026-12-31 ",
  workDays: "default" as const,
};

const writes = () => fake.calls.filter((call) => call.op !== "select");

beforeEach(() => {
  vi.mocked(revalidatePath).mockClear();
  fake.calls = [];
  fake.rows = {
    location: [{ id: LOCATION_A }],
    position: [{ id: POSITION_A }],
    worker: [],
  };
  fake.access = ho;
});

describe("createWorker", () => {
  it("inserts the worker with the trimmed end of contract", async () => {
    const result = await createWorker(input);

    expect(result).toEqual({ ok: true });
    expect(writes()).toEqual([
      {
        op: "insert",
        table: worker,
        values: {
          employeeId: "EMP-001",
          name: "Budi Santoso",
          locationId: LOCATION_A,
          endContract: "2026-12-31",
          workDaysPerWeek: null,
        },
      },
      { op: "delete", table: workerPosition },
      {
        op: "insert",
        table: workerPosition,
        values: [{ workerId: WORKER_NEW, positionId: POSITION_A }],
      },
    ]);
  });

  it("writes no site column, and lets HO create at any location", async () => {
    await createWorker(input);

    expect(writes()[0].values).not.toHaveProperty("siteId");
  });

  it("refuses an admin site creating a worker at another location, and writes nothing", async () => {
    fake.access = { locationId: LOCATION_B } satisfies WorkerAccess;

    const result = await createWorker(input);

    expect(result).toEqual({ ok: false, fieldErrors: { locationId: "Location not found" } });
    expect(writes()).toEqual([]);
  });

  it("lets an admin site create a worker at its own location", async () => {
    fake.access = { locationId: LOCATION_A } satisfies WorkerAccess;

    expect(await createWorker(input)).toEqual({ ok: true });
  });

  it("stores the working-days override", async () => {
    await createWorker({ ...input, workDays: "7" });

    expect(writes()[0]).toMatchObject({
      op: "insert",
      table: worker,
      values: { workDaysPerWeek: 7 },
    });
  });

  it("refuses a working-days value that is not 5 or 7, and writes nothing", async () => {
    const result = await createWorker({
      ...input,
      workDays: "6" as unknown as "5",
    });

    expect(result).toEqual({
      ok: false,
      fieldErrors: { workDays: "Choose working days" },
    });
    expect(writes()).toEqual([]);
  });
});

describe("updateWorker", () => {
  it("sets the new end of contract on the worker", async () => {
    const result = await updateWorker(WORKER_ID, { ...input, endContract: "2027-06-30" });

    expect(result).toEqual({ ok: true });
    expect(writes()).toEqual([
      {
        op: "update",
        table: worker,
        set: {
          employeeId: "EMP-001",
          name: "Budi Santoso",
          locationId: LOCATION_A,
          endContract: "2027-06-30",
          workDaysPerWeek: null,
        },
      },
      { op: "delete", table: workerPosition },
      {
        op: "insert",
        table: workerPosition,
        values: [{ workerId: WORKER_ID, positionId: POSITION_A }],
      },
    ]);
  });

  it("refuses an admin site moving a worker to another location, and writes nothing", async () => {
    fake.access = { locationId: LOCATION_B } satisfies WorkerAccess;

    const result = await updateWorker(WORKER_ID, input);

    expect(result).toEqual({ ok: false, fieldErrors: { locationId: "Location not found" } });
    expect(writes()).toEqual([]);
  });

  it("sets the working-days override", async () => {
    await updateWorker(WORKER_ID, { ...input, workDays: "5" });

    expect(writes()[0]).toMatchObject({ op: "update", set: { workDaysPerWeek: 5 } });
  });

  // This is how an override is cleared.
  it("clears the override when the form sends default", async () => {
    await updateWorker(WORKER_ID, { ...input, workDays: "default" });

    expect(writes()[0]).toMatchObject({ op: "update", set: { workDaysPerWeek: null } });
  });

  it("refuses an update that omits working days, so the override is left alone", async () => {
    const { workDays: omitted, ...withoutWorkDays } = input;

    expect(omitted).toBe("default");
    expect(await updateWorker(WORKER_ID, withoutWorkDays as unknown as typeof input)).toEqual({
      ok: false,
      fieldErrors: { workDays: "Choose working days" },
    });
    expect(writes()).toEqual([]);
  });
});

const DATE_MESSAGE = "End of contract must be a real date like 2026-12-31";
const REQUIRED_MESSAGE = "End of contract is required";

describe.each([
  { label: "2026-02-30", endContract: "2026-02-30", message: DATE_MESSAGE },
  { label: "11/02/2026", endContract: "11/02/2026", message: DATE_MESSAGE },
  { label: "(empty)", endContract: "", message: REQUIRED_MESSAGE },
])("an end of contract of $label", ({ endContract, message }) => {
  it("is refused by createWorker, which writes nothing", async () => {
    const result = await createWorker({ ...input, endContract });

    expect(result).toEqual({ ok: false, fieldErrors: { endContract: message } });
    expect(writes()).toEqual([]);
  });

  it("is refused by updateWorker, which writes nothing", async () => {
    const result = await updateWorker(WORKER_ID, { ...input, endContract });

    expect(result).toEqual({ ok: false, fieldErrors: { endContract: message } });
    expect(writes()).toEqual([]);
  });
});

// The detail page shows a worker's own data, so a change must refresh it as well as the list.
describe("revalidation of the worker pages", () => {
  const list = "/dashboard/workers";
  const detail = ["/dashboard/workers/[id]", "page"] as const;

  it("refreshes the list and the detail page after an update", async () => {
    await updateWorker(WORKER_ID, input);

    expect(revalidatePath).toHaveBeenCalledWith(list);
    expect(revalidatePath).toHaveBeenCalledWith(...detail);
  });

  it("refreshes the list and the detail page after a delete", async () => {
    const result = await deleteWorker(WORKER_ID);

    expect(result).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith(list);
    expect(revalidatePath).toHaveBeenCalledWith(...detail);
  });

  it("refreshes the list and the detail page after a restore", async () => {
    // A deleted worker in a live location, which is what a restore needs to find.
    fake.rows.worker = [{ locationId: LOCATION_A }];
    fake.rows.location = [{ id: LOCATION_A, deletedAt: null }];

    const result = await restoreWorker(WORKER_ID);

    expect(result).toEqual({ ok: true });
    expect(revalidatePath).toHaveBeenCalledWith(list);
    expect(revalidatePath).toHaveBeenCalledWith(...detail);
  });
});
