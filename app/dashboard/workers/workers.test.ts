import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { worker } from "@/database/schema/worker-schema";
import type { WorkerAccess, WorkerListParams } from "@/types/workers";

// The database is replaced by a recorder. Each select is logged as a Call. The recorder cannot run
// a WHERE, so the tests render the recorded `where` to SQL and check what it contains.
type Call = { table?: unknown; where?: SQL };

const fake = vi.hoisted(() => ({
  calls: [] as { table?: unknown; where?: unknown }[],
}));

const dialect = new PgDialect();

function builder(call: Call) {
  fake.calls.push(call);

  const chain = {
    from(table: unknown) {
      call.table = table;
      return chain;
    },
    innerJoin: () => chain,
    where(condition: SQL) {
      call.where = condition;
      return chain;
    },
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      return new Promise((done) => done([{ total: 0 }])).then(resolve, reject);
    },
  };

  return chain;
}

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: () => undefined }));
vi.mock("@/lib/db", () => ({ db: { select: () => builder({}) } }));

const { listWorkers } = await import("./workers");

const access: WorkerAccess = { siteId: null, locationId: null };

const params: WorkerListParams = {
  page: 1,
  pageSize: 10,
  query: "",
  status: "active",
  siteId: null,
  locationId: null,
  positionId: null,
  ending: false,
  sort: [],
};

async function renderedWhere(overrides: Partial<WorkerListParams>): Promise<string> {
  fake.calls.length = 0;
  await listWorkers(access, { ...params, ...overrides });

  const counted = fake.calls.find((call) => call.table === worker);

  return dialect.sqlToQuery(counted?.where as SQL).sql;
}

describe("listWorkers contract ending filter", () => {
  beforeEach(() => {
    fake.calls.length = 0;
  });

  it("limits to active workers whose contract ends from today to 30 days later", async () => {
    const sql = await renderedWhere({ ending: true });

    expect(sql).toContain('"deleted_at" is null');
    expect(sql).toContain('"end_contract" >=');
    expect(sql).toContain('"end_contract" <=');
    expect(sql).toContain("interval '30 days'");
    expect(sql).toContain("timezone(");
  });

  it("reads today in the zone of the worker's location, without a join", async () => {
    const sql = await renderedWhere({ ending: true });

    expect(sql).toContain('from "location"');
    expect(sql).toContain('"location"."id" = "worker"."location_id"');
  });

  it("adds none of that when ending is off", async () => {
    const sql = await renderedWhere({ ending: false });

    expect(sql).not.toContain('"end_contract" >=');
    expect(sql).not.toContain('"end_contract" <=');
    expect(sql).not.toContain("interval");
    expect(sql).not.toContain("timezone(");
  });
});
