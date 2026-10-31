import { describe, expect, it } from "vitest";
import {
  clampPage,
  escapeLikePattern,
  MAX_QUERY_LENGTH,
  parsePageParams,
} from "./pagination";

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

describe("escapeLikePattern", () => {
  it("leaves plain text unchanged", () => {
    expect(escapeLikePattern("budi santoso")).toBe("budi santoso");
  });

  it("escapes LIKE wildcards and the escape character", () => {
    expect(escapeLikePattern("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("clampPage", () => {
  it("keeps page 1 when there are no rows", () => {
    expect(clampPage(4, 0, 10)).toBe(1);
  });

  it("keeps a page that exists", () => {
    expect(clampPage(2, 25, 10)).toBe(2);
  });

  it("moves a page past the end to the last page", () => {
    expect(clampPage(9, 25, 10)).toBe(3);
  });
});
