import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  rosterRequest,
  rosterRequestLine,
  rosterRequestLineDay,
} from "@/database/schema/request-schema";
import type { RequestAccess } from "@/types/requests";

// The database is replaced by a recorder. Each select is logged as a Call, and its rows come from
// `fake.rows`, keyed by the table in `.from(...)`. The recorder cannot run a WHERE or an ORDER BY,
// so the tests feed the day rows in the order the database would return them, and the ordering
// contract is pinned by rendering the recorded orderBy terms to SQL.
type Call = {
  table?: unknown;
  where?: SQL;
  orderBy?: SQL[];
};

const fake = vi.hoisted(() => ({
  calls: [] as { table?: unknown; where?: unknown; orderBy?: unknown[] }[],
  rows: {
    header: [] as unknown[],
    lines: [] as unknown[],
    days: [] as unknown[],
  },
}));

const dialect = new PgDialect();

function result(call: Call): unknown {
  if (call.table === rosterRequest) return fake.rows.header;
  if (call.table === rosterRequestLine) return fake.rows.lines;
  if (call.table === rosterRequestLineDay) return fake.rows.days;
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
vi.mock("@/lib/db", () => ({ db: { select: () => builder({}) } }));

const { getRequest } = await import("./requests");

const REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LINE_1 = "b1111111-1111-4111-8111-111111111111";
const LINE_2 = "b2222222-2222-4222-8222-222222222222";
const DEPT_A = "55555555-5555-4555-8555-555555555555";
const DEPT_B = "66666666-6666-4666-8666-666666666666";
const SUB_A = "77777777-7777-4777-8777-777777777777";
const POSITION_A = "88888888-8888-4888-8888-888888888888";
const POSITION_B = "99999999-9999-4999-8999-999999999999";
const SITE_A = "11111111-1111-4111-8111-111111111111";
const LOCATION_A = "33333333-3333-4333-8333-333333333333";

const access: RequestAccess = { siteId: null, locationId: null };

function header(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    poNumber: "PO-NSL-2611-0001",
    type: "weekly",
    startDate: "2099-01-05",
    status: "pending",
    siteId: SITE_A,
    siteName: "Nestle Kejayan",
    locationId: LOCATION_A,
    locationName: "Gudang Utara",
    createdByName: "Admin A",
    rejectReason: null,
    ...overrides,
  };
}

const lineOne = {
  id: LINE_1,
  departmentId: DEPT_A,
  subDepartmentId: SUB_A,
  positionId: POSITION_A,
};
const lineTwo = {
  id: LINE_2,
  departmentId: DEPT_B,
  subDepartmentId: null,
  positionId: POSITION_B,
};

function dayRows(lineId: string, headcounts: number[]) {
  return headcounts.map((headcount) => ({ lineId, headcount }));
}

function renderOrderBy(table: unknown): string {
  const call = fake.calls.find((c) => c.table === table);
  const terms = (call?.orderBy ?? []) as SQL[];

  return terms.map((term) => dialect.sqlToQuery(term).sql).join(", ");
}

// The WHERE of the header query, rendered to SQL text and bound parameters.
function renderHeaderWhere(): { sql: string; params: unknown[] } {
  const call = fake.calls.find((c) => c.table === rosterRequest);

  return dialect.sqlToQuery(call?.where as SQL);
}

beforeEach(() => {
  fake.calls = [];
  fake.rows = { header: [], lines: [], days: [] };
});

describe("getRequest", () => {
  it("returns null and runs no line or day query when no header row is found", async () => {
    fake.rows.lines = [lineOne];
    fake.rows.days = dayRows(LINE_1, [3]);

    const res = await getRequest(access, REQUEST_ID);

    expect(res).toBeNull();
    expect(fake.calls.map((c) => c.table)).toEqual([rosterRequest]);
  });

  it("groups each weekly line's seven numbers in day order and passes the header through", async () => {
    fake.rows.header = [
      header({ status: "rejected", rejectReason: "Not enough budget" }),
    ];
    fake.rows.lines = [lineOne, lineTwo];
    fake.rows.days = [
      ...dayRows(LINE_1, [0, 3, 3, 0, 5, 5, 5]),
      ...dayRows(LINE_2, [1, 1, 1, 1, 1, 1, 2]),
    ];

    const res = await getRequest(access, REQUEST_ID);

    expect(res).toEqual({
      id: REQUEST_ID,
      poNumber: "PO-NSL-2611-0001",
      type: "weekly",
      startDate: "2099-01-05",
      status: "rejected",
      siteId: SITE_A,
      siteName: "Nestle Kejayan",
      locationId: LOCATION_A,
      locationName: "Gudang Utara",
      createdByName: "Admin A",
      rejectReason: "Not enough budget",
      lineCount: 2,
      lines: [
        {
          departmentId: DEPT_A,
          subDepartmentId: SUB_A,
          positionId: POSITION_A,
          headcounts: [0, 3, 3, 0, 5, 5, 5],
        },
        {
          departmentId: DEPT_B,
          subDepartmentId: null,
          positionId: POSITION_B,
          headcounts: [1, 1, 1, 1, 1, 1, 2],
        },
      ],
    });
  });

  it("gives a daily request one line with a single headcount", async () => {
    fake.rows.header = [header({ type: "daily", status: "approved" })];
    fake.rows.lines = [lineOne];
    fake.rows.days = dayRows(LINE_1, [4]);

    const res = await getRequest(access, REQUEST_ID);

    expect(res?.type).toBe("daily");
    expect(res?.lineCount).toBe(1);
    expect(res?.lines).toEqual([
      {
        departmentId: DEPT_A,
        subDepartmentId: SUB_A,
        positionId: POSITION_A,
        headcounts: [4],
      },
    ]);
  });

  it("gives a line with no day rows an empty headcounts array", async () => {
    fake.rows.header = [header()];
    fake.rows.lines = [lineOne, lineTwo];
    fake.rows.days = dayRows(LINE_2, [2, 2, 2, 2, 2, 0, 0]);

    const res = await getRequest(access, REQUEST_ID);

    expect(res?.lineCount).toBe(2);
    expect(res?.lines[0].headcounts).toEqual([]);
    expect(res?.lines[1].headcounts).toEqual([2, 2, 2, 2, 2, 0, 0]);
  });

  // A request outside the actor's scope must read as missing, so the header query itself has to
  // carry the scope. The recorder cannot run a WHERE, so these tests read the condition it was given.
  describe("scope of the header query", () => {
    it("filters by the request id alone for a superadmin", async () => {
      await getRequest({ siteId: null, locationId: null }, REQUEST_ID);

      const where = renderHeaderWhere();

      expect(where.params).toEqual([REQUEST_ID]);
      expect(where.sql).toContain('"roster_request"."id" = $1');
      expect(where.sql).not.toContain('"roster_request"."site_id"');
      expect(where.sql).not.toContain('"roster_request"."location_id"');
    });

    it("adds the site of an HO to the request id", async () => {
      await getRequest({ siteId: SITE_A, locationId: null }, REQUEST_ID);

      const where = renderHeaderWhere();

      expect(where.params).toEqual([REQUEST_ID, SITE_A]);
      expect(where.sql).toContain('"roster_request"."id" = $1');
      expect(where.sql).toContain('"roster_request"."site_id" = $2');
      expect(where.sql).not.toContain('"roster_request"."location_id"');
    });

    it("adds the location of an admin site, and not its site, to the request id", async () => {
      await getRequest({ siteId: SITE_A, locationId: LOCATION_A }, REQUEST_ID);

      const where = renderHeaderWhere();

      expect(where.params).toEqual([REQUEST_ID, LOCATION_A]);
      expect(where.sql).toContain('"roster_request"."id" = $1');
      expect(where.sql).toContain('"roster_request"."location_id" = $2');
      expect(where.sql).not.toContain('"roster_request"."site_id"');
    });
  });

  it("orders the day query by line, then day offset, and the lines query by line id", async () => {
    fake.rows.header = [header()];
    fake.rows.lines = [lineOne];
    fake.rows.days = dayRows(LINE_1, [1]);

    await getRequest(access, REQUEST_ID);

    expect(fake.calls.map((c) => c.table)).toEqual([
      rosterRequest,
      rosterRequestLine,
      rosterRequestLineDay,
    ]);
    expect(renderOrderBy(rosterRequestLineDay)).toBe(
      '"roster_request_line_day"."line_id" asc, "roster_request_line_day"."day_offset" asc',
    );
    expect(renderOrderBy(rosterRequestLine)).toBe('"roster_request_line"."id" asc');
  });
});
