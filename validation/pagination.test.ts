import { describe, expect, it } from "vitest";
import { MAX_QUERY_LENGTH } from "@/lib/pagination";
import { parsePageParams } from "./pagination";

describe("parsePageParams", () => {
  it("reads a valid page and pageSize", () => {
    expect(parsePageParams({ page: "3", pageSize: "20" })).toEqual({
      page: 3,
      pageSize: 20,
      query: "",
    });
  });

  it("defaults to page 1, pageSize 10 and an empty query when params are missing", () => {
    expect(parsePageParams({})).toEqual({
      page: 1,
      pageSize: 10,
      query: "",
    });
  });

  it("trims the search query", () => {
    expect(parsePageParams({ q: "  budi  " }).query).toBe("budi");
  });

  it("treats a blank query as no query", () => {
    expect(parsePageParams({ q: "   " }).query).toBe("");
  });

  it("caps the search query length", () => {
    const long = "a".repeat(MAX_QUERY_LENGTH + 20);

    expect(parsePageParams({ q: long }).query).toHaveLength(
      MAX_QUERY_LENGTH,
    );
  });

  it("uses the first query value when q is repeated", () => {
    expect(parsePageParams({ q: ["budi", "siti"] }).query).toBe("budi");
  });

  it.each(["abc", "0", "-2", "1.5", ""])(
    "falls back to page 1 for %j",
    (page) => {
      expect(parsePageParams({ page }).page).toBe(1);
    },
  );

  it.each(["15", "1000", "0", ""])(
    "falls back to pageSize 10 for %j",
    (pageSize) => {
      expect(parsePageParams({ pageSize }).pageSize).toBe(10);
    },
  );

  it("uses the first value when a param is repeated", () => {
    expect(parsePageParams({ page: ["2", "5"] }).page).toBe(2);
  });
});
