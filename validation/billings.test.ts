import { describe, expect, it } from "vitest";

import {
  BILLING_MODES,
  BILLING_STATUSES,
  VOID_REASON_MAX_LENGTH,
  createBillingSchema,
  deleteBillingSchema,
  issueBillingSchema,
  parseBillingId,
  parseBillingStatus,
  updateBillingPeriodSchema,
  voidBillingSchema,
} from "./billings";

const UUID = "3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b";

function messages(result: { success: false; error: { issues: { message: string }[] } }) {
  return result.error.issues.map((issue) => issue.message);
}

describe("constants", () => {
  it("lists the modes, statuses and the reason limit", () => {
    expect(BILLING_MODES).toEqual(["monthly", "weekly", "custom"]);
    expect(BILLING_STATUSES).toEqual(["draft", "issued", "void"]);
    expect(VOID_REASON_MAX_LENGTH).toBe(200);
  });
});

describe("createBillingSchema", () => {
  it("accepts a monthly period", () => {
    expect(
      createBillingSchema.safeParse({
        locationId: UUID,
        period: { mode: "monthly", month: "2026-11" },
      }).success,
    ).toBe(true);
  });

  it("accepts a weekly and a custom period", () => {
    expect(
      createBillingSchema.safeParse({
        locationId: UUID,
        period: { mode: "weekly", date: "2026-11-11" },
      }).success,
    ).toBe(true);
    expect(
      createBillingSchema.safeParse({
        locationId: UUID,
        period: { mode: "custom", from: "2026-11-01", to: "2026-11-05" },
      }).success,
    ).toBe(true);
  });

  it("refuses a location that is not a uuid", () => {
    const result = createBillingSchema.safeParse({
      locationId: "x",
      period: { mode: "monthly", month: "2026-11" },
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(messages(result)).toContain("Choose a location");
  });

  it("refuses a custom period that ends before it starts, at the period path", () => {
    const result = createBillingSchema.safeParse({
      locationId: UUID,
      period: { mode: "custom", from: "2026-11-06", to: "2026-11-05" },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["period"], message: "Choose a valid period" }),
      );
    }
  });

  it("refuses a bad month and a bad weekly date", () => {
    expect(
      createBillingSchema.safeParse({
        locationId: UUID,
        period: { mode: "monthly", month: "2026-13" },
      }).success,
    ).toBe(false);
    expect(
      createBillingSchema.safeParse({
        locationId: UUID,
        period: { mode: "weekly", date: "2026-02-30" },
      }).success,
    ).toBe(false);
  });

  it("refuses a custom period longer than 366 days", () => {
    expect(
      createBillingSchema.safeParse({
        locationId: UUID,
        period: { mode: "custom", from: "2026-01-01", to: "2027-01-02" },
      }).success,
    ).toBe(false);
  });

  it("refuses an unknown mode", () => {
    expect(
      createBillingSchema.safeParse({ locationId: UUID, period: { mode: "daily" } }).success,
    ).toBe(false);
  });
});

describe("updateBillingPeriodSchema", () => {
  it("accepts a billing, a version and a period", () => {
    expect(
      updateBillingPeriodSchema.safeParse({
        billingId: UUID,
        version: "2026-11-19T00:00:00.000Z",
        period: { mode: "monthly", month: "2026-11" },
      }).success,
    ).toBe(true);
  });

  it("refuses a missing version and a bad billing id", () => {
    const result = updateBillingPeriodSchema.safeParse({
      billingId: "x",
      version: "",
      period: { mode: "monthly", month: "2026-11" },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(messages(result)).toEqual(
        expect.arrayContaining(["Choose a billing", "The billing version is missing"]),
      );
    }
  });
});

describe("issueBillingSchema", () => {
  it("accepts a billing and a version", () => {
    expect(issueBillingSchema.safeParse({ billingId: UUID, version: "v" }).success).toBe(true);
  });

  it("refuses an empty version", () => {
    const result = issueBillingSchema.safeParse({ billingId: UUID, version: "" });

    expect(result.success).toBe(false);
    if (!result.success) expect(messages(result)).toContain("The billing version is missing");
  });
});

describe("voidBillingSchema", () => {
  it("refuses a blank reason", () => {
    const result = voidBillingSchema.safeParse({ billingId: UUID, version: "v", reason: "   " });

    expect(result.success).toBe(false);
    if (!result.success) expect(messages(result)).toContain("A reason is required to void");
  });

  it("trims the reason", () => {
    expect(
      voidBillingSchema.parse({ billingId: UUID, version: "v", reason: "  wrong period  " }).reason,
    ).toBe("wrong period");
  });

  it("accepts 200 characters and refuses 201", () => {
    expect(
      voidBillingSchema.safeParse({ billingId: UUID, version: "v", reason: "a".repeat(200) })
        .success,
    ).toBe(true);

    const result = voidBillingSchema.safeParse({
      billingId: UUID,
      version: "v",
      reason: "a".repeat(201),
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(messages(result)).toContain("Reason must be 200 characters or fewer");
  });
});

describe("deleteBillingSchema", () => {
  it("accepts a uuid and refuses anything else", () => {
    expect(deleteBillingSchema.safeParse({ billingId: UUID }).success).toBe(true);
    expect(deleteBillingSchema.safeParse({ billingId: "x" }).success).toBe(false);
  });
});

describe("parseBillingId", () => {
  it("returns a uuid and null for anything else", () => {
    expect(parseBillingId(UUID)).toBe(UUID);
    expect(parseBillingId("not-a-uuid")).toBeNull();
    expect(parseBillingId("")).toBeNull();
  });
});

describe("parseBillingStatus", () => {
  it("reads a known status", () => {
    expect(parseBillingStatus("issued")).toBe("issued");
    expect(parseBillingStatus("draft")).toBe("draft");
  });

  it("falls back to all", () => {
    expect(parseBillingStatus("bogus")).toBe("all");
    expect(parseBillingStatus(undefined)).toBe("all");
    expect(parseBillingStatus("")).toBe("all");
  });

  it("takes the first value of a repeated parameter", () => {
    expect(parseBillingStatus(["void", "x"])).toBe("void");
  });
});
