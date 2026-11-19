import { describe, expect, it } from "vitest";
import { formatBillingNumber } from "./billing-number";

describe("formatBillingNumber", () => {
  it("pads the sequence to 4 digits", () => {
    expect(formatBillingNumber("JKT", "202611", 7)).toBe("BL-JKT-202611-0007");
  });

  it("grows past 9999 without a cap", () => {
    expect(formatBillingNumber("JKT", "202611", 12345)).toBe("BL-JKT-202611-12345");
  });
});
