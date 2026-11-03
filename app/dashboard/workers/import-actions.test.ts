import { TransactionRollbackError } from "drizzle-orm";
import writeXlsxFile, { type SheetData } from "write-excel-file/node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { location } from "@/database/schema/location-schema";
import { position } from "@/database/schema/position-schema";
import { site } from "@/database/schema/site-schema";
import { worker, workerPosition } from "@/database/schema/worker-schema";
import type { WorkerAccess } from "@/types/workers";

// The database is replaced by a recorder. Every query is logged as a Call, and the result of a
// read comes from `rows`, keyed by the table it reads. The workbook, its reader, and the resolver
// are real, so only the database and the guard are fake.
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
    site: [] as unknown[],
    location: [] as unknown[],
    position: [] as unknown[],
    worker: [] as unknown[],
  },
  access: null as unknown,
}));

function result(call: Call): unknown {
  if (call.op === "select") {
    if (call.table === site) return fake.rows.site;
    if (call.table === location) return fake.rows.location;
    if (call.table === position) return fake.rows.position;
    if (call.table === worker) return fake.rows.worker;
    return [];
  }

  if (call.op === "insert" && call.table === worker) return [{ id: WORKER_NEW }];
  if (call.op === "update" && call.table === worker) return [{ id: WORKER_OLD }];

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

const query = {
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
vi.mock("@/lib/db", () => {
  // Like drizzle, rollback throws, and the transaction passes the error on to the caller.
  const tx = {
    ...query,
    rollback: () => {
      throw new TransactionRollbackError();
    },
  };

  return {
    db: { ...query, transaction: async (run: (t: typeof tx) => unknown) => run(tx) },
  };
});

const { commitWorkerImport } = await import("./import-actions");

const SITE_A = "11111111-1111-4111-8111-111111111111";
const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const POSITION_A = "88888888-8888-4888-8888-888888888888";
const WORKER_OLD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WORKER_NEW = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const superadmin: WorkerAccess = { siteId: null, locationId: null };

const HEADER = ["employee_id", "name", "site", "location", "positions", "end_contract"];

async function upload(rows: SheetData): Promise<FormData> {
  const bytes = await writeXlsxFile(rows).toBuffer();
  const formData = new FormData();

  formData.append("file", new File([new Uint8Array(bytes)], "workers.xlsx"));

  return formData;
}

const writes = () => fake.calls.filter((call) => call.op !== "select");

beforeEach(() => {
  fake.calls = [];
  fake.rows = {
    site: [{ id: SITE_A, name: "Alpha" }],
    location: [{ id: LOCATION_A, siteId: SITE_A, name: "Gudang" }],
    position: [{ id: POSITION_A, siteId: SITE_A, name: "Operator" }],
    worker: [{ id: WORKER_OLD, employeeId: "EMP-002", siteId: SITE_A, locationId: LOCATION_A }],
  };
  fake.access = superadmin;
});

describe("commitWorkerImport", () => {
  it("writes each row's end of contract on the insert and on the update", async () => {
    const formData = await upload([
      HEADER,
      ["EMP-001", "Budi Santoso", "Alpha", "Gudang", "Operator", "2026-12-31"],
      ["EMP-002", "Sari Dewi", "Alpha", "Gudang", null, "2027-06-30"],
    ]);

    const result = await commitWorkerImport(formData);

    expect(result).toEqual({ ok: true, created: 1, updated: 1 });
    expect(fake.calls.filter((call) => call.op === "select")).toEqual([
      { op: "select", table: site, lock: "share" },
      { op: "select", table: location, lock: "share" },
      { op: "select", table: position, lock: "share" },
      { op: "select", table: worker },
    ]);
    expect(writes()).toEqual([
      {
        op: "insert",
        table: worker,
        values: {
          employeeId: "EMP-001",
          name: "Budi Santoso",
          siteId: SITE_A,
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
      {
        op: "update",
        table: worker,
        set: {
          employeeId: "EMP-002",
          name: "Sari Dewi",
          siteId: SITE_A,
          locationId: LOCATION_A,
          endContract: "2027-06-30",
        },
      },
      { op: "delete", table: workerPosition },
    ]);
  });

  it("returns the preview with the row error for an invalid date and writes nothing", async () => {
    const formData = await upload([
      HEADER,
      ["EMP-001", "Budi Santoso", "Alpha", "Gudang", "Operator", "2026-12-31"],
      ["EMP-002", "Sari Dewi", "Alpha", "Gudang", null, "2026-02-30"],
    ]);

    const result = await commitWorkerImport(formData);

    expect(result).toEqual({
      ok: false,
      preview: {
        rows: [
          {
            rowNumber: 2,
            employeeId: "EMP-001",
            name: "Budi Santoso",
            siteName: "Alpha",
            locationName: "Gudang",
            positionNames: ["Operator"],
            endContract: "2026-12-31",
            workDays: null,
            action: "create",
            errors: [],
            workerId: null,
            siteId: SITE_A,
            locationId: LOCATION_A,
            positionIds: [POSITION_A],
          },
          {
            rowNumber: 3,
            employeeId: "EMP-002",
            name: "Sari Dewi",
            siteName: "Alpha",
            locationName: "Gudang",
            positionNames: [],
            endContract: "2026-02-30",
            workDays: null,
            action: "error",
            errors: ["end_contract must be a date like 2026-12-31"],
          },
        ],
        summary: { create: 1, update: 0, error: 1 },
      },
    });
    expect(writes()).toEqual([]);
  });

  it("refuses a file without the end_contract column and writes nothing", async () => {
    const formData = await upload([
      HEADER.slice(0, 5),
      ["EMP-001", "Budi Santoso", "Alpha", "Gudang", "Operator"],
      ["EMP-002", "Sari Dewi", "Alpha", "Gudang", null],
    ]);

    const result = await commitWorkerImport(formData);

    expect(result).toEqual({ ok: false, formError: "Missing columns: end_contract" });
    expect(writes()).toEqual([]);
  });
});

describe("commitWorkerImport work_days", () => {
  const WITH_WORK_DAYS = [...HEADER, "work_days"];

  it("inserts the work_days of a create row, and null when the cell is blank", async () => {
    const result = await commitWorkerImport(
      await upload([
        WITH_WORK_DAYS,
        ["EMP-001", "Budi", "Alpha", "Gudang", null, "2026-12-31", 7],
        ["EMP-003", "Sari", "Alpha", "Gudang", null, "2026-12-31", null],
      ]),
    );

    expect(result).toEqual({ ok: true, created: 2, updated: 0 });

    const inserts = writes().filter((call) => call.op === "insert" && call.table === worker);

    expect(inserts.map((call) => (call.values as Record<string, unknown>).workDaysPerWeek)).toEqual([7, null]);
  });

  it("sets work_days on an update row only when the cell has a value", async () => {
    const withValue = await commitWorkerImport(
      await upload([WITH_WORK_DAYS, ["EMP-002", "Sari", "Alpha", "Gudang", null, "2026-12-31", 7]]),
    );

    expect(withValue).toEqual({ ok: true, created: 0, updated: 1 });

    const [setWithValue] = writes().filter((call) => call.op === "update");

    expect(setWithValue.set).toMatchObject({ workDaysPerWeek: 7 });

    fake.calls = [];

    const blank = await commitWorkerImport(
      await upload([WITH_WORK_DAYS, ["EMP-002", "Sari", "Alpha", "Gudang", null, "2026-12-31", null]]),
    );

    expect(blank).toEqual({ ok: true, created: 0, updated: 1 });

    const [setBlank] = writes().filter((call) => call.op === "update");

    expect(setBlank.set).not.toHaveProperty("workDaysPerWeek");
  });

  it("keeps an existing override when the file has no work_days column", async () => {
    const result = await commitWorkerImport(
      await upload([HEADER, ["EMP-002", "Sari", "Alpha", "Gudang", null, "2026-12-31"]]),
    );

    expect(result).toEqual({ ok: true, created: 0, updated: 1 });

    const [update] = writes().filter((call) => call.op === "update");

    expect(update.set).not.toHaveProperty("workDaysPerWeek");
  });

  it("refuses an invalid work_days and writes nothing", async () => {
    const result = await commitWorkerImport(
      await upload([
        WITH_WORK_DAYS,
        ["EMP-001", "Budi", "Alpha", "Gudang", null, "2026-12-31", 5],
        ["EMP-003", "Sari", "Alpha", "Gudang", null, "2026-12-31", 6],
      ]),
    );

    expect(result).toMatchObject({
      ok: false,
      preview: { summary: { create: 1, update: 0, error: 1 } },
    });
    expect(writes()).toEqual([]);
  });
});
