import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { workRule } from "@/database/schema/work-rule-schema";
import type { Reader } from "@/types/rosters";
import type { WorkRuleRow } from "@/types/settings";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

const { loadEngineRules } = await import("./roster-work-rules");

const LOCATION_ID = "33333333-3333-4333-8333-333333333333";

const NOTHING_SET: WorkRuleRow = {
  workDaysPerWeek: null,
  breakDays: null,
  breakCycleMonths: null,
  annualOffDays: null,
  shiftExceptionDays: null,
  requirePositionMatch: null,
  keepPreviousPlacement: null,
  maxWorkingDaysPerMonth: null,
};

const row = (set: Partial<WorkRuleRow>): WorkRuleRow => ({ ...NOTHING_SET, ...set });

const dialect = new PgDialect();

// Each select is answered by the scope its WHERE asks for, read from the rendered SQL, so the
// test also pins which two rows are read.
const stored = { global: null, location: null } as Record<
  "global" | "location",
  WorkRuleRow | null
>;
const calls: { table: unknown; sql: string; params: unknown[] }[] = [];

const reader = {
  select: () => ({
    from: (table: unknown) => ({
      where: async (condition: SQL) => {
        const { sql, params } = dialect.sqlToQuery(condition);

        calls.push({ table, sql, params });

        const found = stored[params[0] as keyof typeof stored];

        return found ? [found] : [];
      },
    }),
  }),
} as unknown as Reader;

const target = { locationId: LOCATION_ID };

beforeEach(() => {
  stored.global = null;
  stored.location = null;
  calls.length = 0;
});

describe("loadEngineRules", () => {
  it("gives the built-in defaults when no level sets a rule", async () => {
    expect(await loadEngineRules(reader, target)).toEqual({
      workDaysPerWeek: 5,
      shiftExceptionDays: 7,
      requirePositionMatch: true,
      keepPreviousPlacement: false,
      maxWorkingDaysPerMonth: 26,
    });
  });

  it("reads the global row and the location's row from work_rule, and nothing else", async () => {
    await loadEngineRules(reader, target);

    expect(calls.map((call) => call.table)).toEqual([workRule, workRule]);
    expect(calls.map((call) => call.params)).toEqual([["global"], ["location", LOCATION_ID]]);
    expect(calls.map((call) => call.sql).join(" ")).not.toContain("site");
  });

  it("lets the location win over global, rule by rule", async () => {
    stored.global = row({
      workDaysPerWeek: 7,
      shiftExceptionDays: 2,
      requirePositionMatch: false,
      maxWorkingDaysPerMonth: 30,
    });
    stored.location = row({ workDaysPerWeek: 5, shiftExceptionDays: 4, requirePositionMatch: true });

    expect(await loadEngineRules(reader, target)).toEqual({
      workDaysPerWeek: 5,
      shiftExceptionDays: 4,
      requirePositionMatch: true,
      keepPreviousPlacement: false,
      maxWorkingDaysPerMonth: 30,
    });
  });

  it("inherits global when the location has no row of its own", async () => {
    stored.global = row({ workDaysPerWeek: 7, keepPreviousPlacement: true });

    expect(await loadEngineRules(reader, target)).toMatchObject({
      workDaysPerWeek: 7,
      keepPreviousPlacement: true,
    });
  });

  it("treats a null column as inherit, not as zero or false", async () => {
    stored.global = row({ workDaysPerWeek: 7, requirePositionMatch: false });
    stored.location = row({ workDaysPerWeek: null, requirePositionMatch: null });

    expect(await loadEngineRules(reader, target)).toMatchObject({
      workDaysPerWeek: 7,
      requirePositionMatch: false,
    });
  });
});
