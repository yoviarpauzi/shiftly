import { readFileSync } from "node:fs";
import type { SQL } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { location } from "@/database/schema/location-schema";

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
vi.mock("./location-guard", () => ({ requireLocationManager: async () => ({}) }));

const { createLocation } = await import("./actions");
const { DUPLICATE_NAME_MESSAGE } = await import("./location-rules");

beforeEach(() => {
  fake.insertError = null;
  fake.inserted = [];
});

describe("location actions module", () => {
  it("opens with the use server directive so client components can call it", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

    expect(source.split("\n")[0].trim()).toBe('"use server";');
  });
});

describe("createLocation", () => {
  it("creates a location without a site", async () => {
    const result = await createLocation({ name: "Kejayan", timezone: "Asia/Jakarta" });

    expect(result).toEqual({ ok: true });
    expect(fake.inserted).toEqual([{ name: "Kejayan", timezone: "Asia/Jakarta" }]);
  });

  it("maps a unique violation, as raised for a name in different case, to the name field", async () => {
    fake.insertError = { code: "23505" };

    const result = await createLocation({ name: "KEJAYAN", timezone: "Asia/Jakarta" });

    expect(result).toEqual({ ok: false, fieldErrors: { name: DUPLICATE_NAME_MESSAGE } });
  });

  it("rethrows an error that is not a unique violation", async () => {
    fake.insertError = new Error("connection lost");

    await expect(
      createLocation({ name: "Kejayan", timezone: "Asia/Jakarta" }),
    ).rejects.toThrow("connection lost");
  });
});

describe("location unique name index", () => {
  it("is unique on lower(name) among active rows, so names differing by case collide", () => {
    const index = getTableConfig(location).indexes.find(
      (candidate) => candidate.config.name === "location_lowerName_active_unique",
    );

    expect(index?.config.unique).toBe(true);
    expect(index?.config.columns).toHaveLength(1);
    expect(new PgDialect().sqlToQuery(index?.config.columns[0] as SQL).sql).toBe(
      'lower("location"."name")',
    );
    expect(index?.config.where).toBeDefined();
  });
});
