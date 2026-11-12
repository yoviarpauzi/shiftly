import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerAccess } from "@/types/workers";

const dialect = new PgDialect();

// Each select takes the next result from `queue`. Each where is kept in call order.
const fake = vi.hoisted(() => ({
  queue: [] as unknown[][],
  wheres: [] as unknown[],
  selects: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: () => undefined }));
vi.mock("@/app/dashboard/rosters/roster-work-rules", () => ({
  loadEngineRules: vi.fn(async () => ({ workDaysPerWeek: 5 })),
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => {
      fake.selects += 1;

      const result = fake.queue.shift() ?? [];
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
        where: (condition: unknown) => {
          fake.wheres.push(condition);
          return chain;
        },
        orderBy: () => chain,
        limit: () => chain,
        then: (resolve: (value: unknown[]) => unknown) => resolve(result),
      };

      return chain;
    },
  },
}));

const { getWorkerDetail } = await import("./workers");
const { loadEngineRules } = await import("@/app/dashboard/rosters/roster-work-rules");

const WORKER = "99999999-9999-4999-8999-999999999999";
const SITE = "11111111-1111-4111-8111-111111111111";
const LOCATION = "33333333-3333-4333-8333-333333333331";

const SUPERADMIN: WorkerAccess = { siteId: null, locationId: null };
const ADMIN_SITE: WorkerAccess = { siteId: SITE, locationId: LOCATION };

function workerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WORKER,
    employeeId: "EMP-0001",
    name: "Andi Saputra",
    siteId: SITE,
    siteName: "Nestle Kejayan",
    locationId: LOCATION,
    locationName: "Gudang Utara",
    endContract: "2026-12-31",
    workDaysPerWeek: null,
    deletedAt: null,
    timezone: "Asia/Jakarta",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(loadEngineRules).mockClear();
  fake.queue = [];
  fake.wheres = [];
  fake.selects = 0;
});

describe("getWorkerDetail", () => {
  it("returns null and reads nothing more when no worker matches", async () => {
    fake.queue = [[]];

    expect(await getWorkerDetail(SUPERADMIN, WORKER)).toBeNull();
    expect(fake.selects).toBe(1);
  });

  it("asks for the id inside the access scope", async () => {
    fake.queue = [[]];
    await getWorkerDetail(ADMIN_SITE, WORKER);

    const { params } = dialect.sqlToQuery(fake.wheres[0] as SQL);

    expect(params).toEqual(expect.arrayContaining([WORKER, SITE, LOCATION]));
  });

  it("does not hide a deleted worker", async () => {
    fake.queue = [[]];
    await getWorkerDetail(SUPERADMIN, WORKER);

    expect(dialect.sqlToQuery(fake.wheres[0] as SQL).sql).not.toContain(
      '"worker"."deleted_at" is null',
    );
  });

  it("follows the work rule when the worker has no value of its own", async () => {
    fake.queue = [[workerRow()], [{ workerId: WORKER, id: "p-1", name: "Operator Produksi" }]];

    const detail = await getWorkerDetail(SUPERADMIN, WORKER);

    expect(detail?.workDays).toBe(5);
    expect(detail?.timezone).toBe("Asia/Jakarta");
    expect(detail?.positions).toEqual([{ id: "p-1", name: "Operator Produksi" }]);
  });

  it("prefers the worker's own working days", async () => {
    fake.queue = [[workerRow({ workDaysPerWeek: 7 })], []];

    expect((await getWorkerDetail(SUPERADMIN, WORKER))?.workDays).toBe(7);
  });

  it("does not read the work rules when the worker has its own working days", async () => {
    fake.queue = [[workerRow({ workDaysPerWeek: 5 })], []];

    await getWorkerDetail(SUPERADMIN, WORKER);

    expect(loadEngineRules).not.toHaveBeenCalled();
  });

  it("reads the work rules once when it follows them", async () => {
    fake.queue = [[workerRow()], []];

    await getWorkerDetail(SUPERADMIN, WORKER);

    expect(loadEngineRules).toHaveBeenCalledTimes(1);
  });
});
