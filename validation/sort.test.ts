import { describe, expect, it } from "vitest";
import { parseSortParam, serializeSort } from "./sort";

const COLUMNS = ["name", "locations", "status"] as const;

describe("parseSortParam", () => {
  it("returns no criteria when the parameter is missing or empty", () => {
    expect(parseSortParam(undefined, COLUMNS)).toEqual([]);
    expect(parseSortParam("", COLUMNS)).toEqual([]);
  });

  it("keeps the order of the criteria", () => {
    expect(parseSortParam("name:asc,locations:desc", COLUMNS)).toEqual([
      { column: "name", direction: "asc" },
      { column: "locations", direction: "desc" },
    ]);
  });

  it("drops unknown columns and unknown directions", () => {
    expect(parseSortParam("name:up,hack:asc,locations:desc", COLUMNS)).toEqual([
      { column: "locations", direction: "desc" },
    ]);
  });

  it("keeps only the first occurrence of a repeated column", () => {
    expect(parseSortParam("name:asc,name:desc", COLUMNS)).toEqual([
      { column: "name", direction: "asc" },
    ]);
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseSortParam(["name:desc", "locations:asc"], COLUMNS)).toEqual([
      { column: "name", direction: "desc" },
    ]);
  });
});

describe("serializeSort", () => {
  it("writes criteria in the same form that parseSortParam reads", () => {
    const criteria = [
      { column: "name" as const, direction: "asc" as const },
      { column: "status" as const, direction: "desc" as const },
    ];

    expect(parseSortParam(serializeSort(criteria), COLUMNS)).toEqual(criteria);
    expect(serializeSort(criteria)).toBe("name:asc,status:desc");
  });
});
