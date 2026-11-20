import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Reader } from "@/types/rosters";

vi.mock("server-only", () => ({}));

const dialect = new PgDialect();

const fake = vi.hoisted(() => ({ selects: 0, wheres: [] as unknown[], rows: [] as unknown[] }));

const reader = {
  select: () => {
    fake.selects += 1;
    const chain = {
      from: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      where: (condition: unknown) => {
        fake.wheres.push(condition);
        return chain;
      },
      orderBy: () => chain,
      then: (resolve: (value: unknown[]) => unknown) => resolve(fake.rows),
    };

    return chain;
  },
} as unknown as Reader;

const { coverRowsQuery } = await import("./attendance-cover");

beforeEach(() => {
  fake.selects = 0;
  fake.wheres = [];
  fake.rows = [];
});

describe("coverRowsQuery", () => {
  it("does not query without workers", async () => {
    expect(await coverRowsQuery(reader, [], "2026-11-01", "2026-11-30")).toEqual([]);
    expect(fake.selects).toBe(0);
  });

  it("binds the workers, the date range, an absent mark, a confirmed roster and an approved request", async () => {
    await coverRowsQuery(reader, ["w1", "w2"], "2026-11-01", "2026-11-30");

    const { sql, params } = dialect.sqlToQuery(fake.wheres[0] as SQL);

    expect(params).toEqual(
      expect.arrayContaining(["w1", "w2", "2026-11-01", "2026-11-30", "absent", "work", "confirmed", "approved"]),
    );
    expect(sql).toContain('"attendance_substitute"."work_date" >=');
    expect(sql).toContain('"attendance_substitute"."work_date" <=');
    expect(sql).toContain('"roster"."status" =');
    expect(sql).toContain('"roster_request"."status" =');
    expect(sql).toContain('"attendance"."status" =');
  });

  it("adds the caller's scope condition and no location condition of its own", async () => {
    await coverRowsQuery(reader, ["w1"], "2026-11-01", "2026-11-30");
    const unscoped = dialect.sqlToQuery(fake.wheres[0] as SQL);

    expect(unscoped.sql).not.toContain("location");

    const { sql } = await import("drizzle-orm");
    await coverRowsQuery(reader, ["w1"], "2026-11-01", "2026-11-30", sql`scope-marker = ${"loc-1"}`);
    const scoped = dialect.sqlToQuery(fake.wheres[1] as SQL);

    expect(scoped.sql).toContain("scope-marker");
    expect(scoped.params).toContain("loc-1");
  });

  it("returns the rows the reader gives", async () => {
    fake.rows = [{ id: "sub-1" }];

    expect(await coverRowsQuery(reader, ["w1"], "2026-11-01", "2026-11-30")).toEqual([{ id: "sub-1" }]);
  });
});
