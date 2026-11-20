import { readFileSync } from "node:fs";
import type { SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { position } from "@/database/schema/position-schema";

const fake = vi.hoisted(() => ({
  insertError: null as unknown,
  inserted: [] as unknown[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: async (row: unknown) => {
        if (fake.insertError) {
          throw fake.insertError;
        }
        fake.inserted.push(row);
      },
    }),
  },
}));
vi.mock("./position-guard", () => ({ requirePositionManager: async () => ({ role: "ho" }) }));

const { createPosition } = await import("./actions");
const { DUPLICATE_POSITION_NAME_MESSAGE } = await import("./position-rules");

beforeEach(() => {
  fake.insertError = null;
  fake.inserted = [];
});

// The directive is what makes the exports server actions, so the test reads the file.
describe("position actions module", () => {
  it("opens with the use server directive so client components can call it", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

    expect(source.split("\n")[0].trim()).toBe('"use server";');
  });
});

describe("createPosition", () => {
  it("creates a position from a name alone", async () => {
    const result = await createPosition({ name: "Operator" });

    expect(result).toEqual({ ok: true });
    expect(fake.inserted).toEqual([{ name: "Operator" }]);
  });

  it("maps the unique violation Postgres raises for a name in different case to the name field", async () => {
    fake.insertError = {
      code: "23505",
      constraint: "position_lowerName_active_unique",
    };

    const result = await createPosition({ name: "OPERATOR" });

    expect(result).toEqual({
      ok: false,
      fieldErrors: { name: DUPLICATE_POSITION_NAME_MESSAGE },
    });
  });

  it("rethrows an error that is not the name conflict", async () => {
    fake.insertError = new Error("connection lost");

    await expect(createPosition({ name: "Operator" })).rejects.toThrow("connection lost");
  });
});

describe("position unique name index", () => {
  it("is unique on lower(name) among active rows across all positions", () => {
    const index = getTableConfig(position).indexes.find(
      (candidate) => candidate.config.name === "position_lowerName_active_unique",
    );

    expect(index?.config.unique).toBe(true);
    expect(index?.config.columns).toHaveLength(1);
    expect(new PgDialect().sqlToQuery(index?.config.columns[0] as SQL).sql).toBe(
      'lower("position"."name")',
    );
    expect(index?.config.where).toBeDefined();
  });
});
