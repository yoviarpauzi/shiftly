import { describe, expect, it } from "vitest";
import { bulkDeleteMessage } from "./site-rules";

describe("bulkDeleteMessage", () => {
  it("reports several deleted sites", () => {
    expect(bulkDeleteMessage(2, 0)).toBe("2 sites deleted");
  });

  it("reports one deleted site in the singular", () => {
    expect(bulkDeleteMessage(1, 0)).toBe("1 site deleted");
  });

  it("reports sites that could not be deleted", () => {
    expect(bulkDeleteMessage(0, 2)).toBe("2 sites could not be deleted");
  });

  it("reports both outcomes when some sites were blocked", () => {
    expect(bulkDeleteMessage(1, 1)).toBe(
      "1 site deleted, 1 could not be deleted",
    );
  });
});
