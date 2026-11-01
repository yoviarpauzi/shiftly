import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "@/error/db-error";

describe("isUniqueViolation", () => {
  it("detects a Postgres unique violation", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("detects a unique violation wrapped by Drizzle", () => {
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
  });

  it.each([
    { code: "23503" },
    { cause: { code: "23503" } },
    new Error("boom"),
    null,
    undefined,
  ])("ignores %o", (error) => {
    expect(isUniqueViolation(error)).toBe(false);
  });
});
