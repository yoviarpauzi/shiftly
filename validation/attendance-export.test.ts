import { describe, expect, it } from "vitest";
import { parseExportParams } from "./attendance-export";

const LOCATION = "33333333-3333-4333-8333-333333333331";

const params = (query: string) => new URLSearchParams(query);

describe("parseExportParams", () => {
  it("reads a location uuid and a real date", () => {
    expect(parseExportParams(params(`location=${LOCATION}&date=2026-11-11`))).toEqual({
      locationId: LOCATION,
      date: "2026-11-11",
    });
  });

  it.each([
    ["no location", "date=2026-11-11"],
    ["a location that is not a uuid", "location=abc&date=2026-11-11"],
    ["a repeated location", `location=${LOCATION}&location=${LOCATION}&date=2026-11-11`],
    ["no date", `location=${LOCATION}`],
    ["a date that is not a date", `location=${LOCATION}&date=abc`],
    ["a date that does not exist", `location=${LOCATION}&date=2026-02-30`],
    ["a repeated date", `location=${LOCATION}&date=2026-11-11&date=2026-11-12`],
  ])("gives null for %s", (_label, query) => {
    expect(parseExportParams(params(query))).toBeNull();
  });
});
