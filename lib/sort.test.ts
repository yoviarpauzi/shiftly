import { describe, expect, it } from "vitest";
import { nextSort } from "./sort";

const name = (direction: "asc" | "desc") => ({ column: "name", direction });
const locations = (direction: "asc" | "desc") => ({ column: "locations", direction });

describe("nextSort without shift", () => {
  it("makes a column the only sort, ascending first", () => {
    expect(nextSort([], "name", false)).toEqual([name("asc")]);
  });

  it("reverses direction when the only sort is that column", () => {
    expect(nextSort([name("asc")], "name", false)).toEqual([name("desc")]);
  });

  it("clears the sort on the third click of the only column", () => {
    expect(nextSort([name("desc")], "name", false)).toEqual([]);
  });

  it("replaces several sorts with the clicked column", () => {
    expect(nextSort([name("asc"), locations("desc")], "locations", false)).toEqual([
      locations("asc"),
    ]);
  });
});

describe("nextSort with shift", () => {
  it("adds a column after the existing ones, ascending first", () => {
    expect(nextSort([], "name", true)).toEqual([name("asc")]);
    expect(nextSort([name("asc")], "locations", true)).toEqual([
      name("asc"),
      locations("asc"),
    ]);
  });

  it("reverses an existing column in place", () => {
    expect(nextSort([name("asc"), locations("asc")], "name", true)).toEqual([
      name("desc"),
      locations("asc"),
    ]);
  });

  it("removes an existing column on its third click, keeping the others in order", () => {
    expect(nextSort([name("desc"), locations("asc")], "name", true)).toEqual([
      locations("asc"),
    ]);
  });
});
