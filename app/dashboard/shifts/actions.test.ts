import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The actions module depends on the database, so it cannot be imported in tests.
// The directive is what makes its exports server actions, so the test reads the file.
describe("shift actions module", () => {
  it("opens with the use server directive so client components can call it", () => {
    const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

    expect(source.split("\n")[0].trim()).toBe('"use server";');
  });
});
