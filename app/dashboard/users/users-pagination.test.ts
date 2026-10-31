import { describe, expect, it } from "vitest";
import { clampPage, parseUsersPageParams } from "./users-pagination";

describe("parseUsersPageParams", () => {
  it("reads a valid page and pageSize", () => {
    expect(parseUsersPageParams({ page: "3", pageSize: "20" })).toEqual({
      page: 3,
      pageSize: 20,
    });
  });

  it("defaults to page 1 and pageSize 10 when params are missing", () => {
    expect(parseUsersPageParams({})).toEqual({ page: 1, pageSize: 10 });
  });

  it.each(["abc", "0", "-2", "1.5", ""])("falls back to page 1 for %j", (page) => {
    expect(parseUsersPageParams({ page }).page).toBe(1);
  });

  it.each(["15", "1000", "0", ""])(
    "falls back to pageSize 10 for %j",
    (pageSize) => {
      expect(parseUsersPageParams({ pageSize }).pageSize).toBe(10);
    },
  );

  it("uses the first value when a param is repeated", () => {
    expect(parseUsersPageParams({ page: ["2", "5"] }).page).toBe(2);
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
