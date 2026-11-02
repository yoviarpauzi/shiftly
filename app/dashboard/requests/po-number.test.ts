import { describe, expect, it } from "vitest";
import { formatPoNumber, poPeriod } from "./po-number";

describe("poPeriod", () => {
  it("uses the Jakarta month, not the UTC month", () => {
    expect(poPeriod(new Date("2026-11-30T17:30:00Z"), "Asia/Jakarta")).toBe("202612");
  });

  it("keeps the month just before the Jakarta rollover", () => {
    expect(poPeriod(new Date("2026-11-30T16:59:00Z"), "Asia/Jakarta")).toBe("202611");
  });

  it("gives the next month for Makassar at the month end", () => {
    const now = new Date("2026-10-31T16:30:00Z");

    expect(poPeriod(now, "Asia/Makassar")).toBe("202611");
    expect(poPeriod(now, "Asia/Jakarta")).toBe("202610");
  });
});

describe("formatPoNumber", () => {
  it("pads the sequence to 4 digits", () => {
    expect(formatPoNumber("NSL", "202611", 1)).toBe("PO-NSL-202611-0001");
  });

  it("keeps 9999 at 4 digits", () => {
    expect(formatPoNumber("NSL", "202611", 9999)).toBe("PO-NSL-202611-9999");
  });

  it("grows past 9999 without a cap", () => {
    expect(formatPoNumber("NSL", "202611", 10000)).toBe("PO-NSL-202611-10000");
  });
});
