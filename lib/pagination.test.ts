import { describe, expect, it } from "vitest";
import { clampPage, escapeLikePattern } from "./pagination";

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
