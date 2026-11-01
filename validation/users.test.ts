import { describe, expect, it } from "vitest";
import { createUserSchema, updateUserSchema } from "./users";

const SITE_ID = "11111111-1111-4111-8111-111111111111";
const LOCATION_ID = "22222222-2222-4222-8222-222222222222";

const base = {
  name: "Ani",
  email: "ani@example.com",
  password: "password123",
  role: "superadmin",
  siteId: null,
  locationId: null,
};

const createMessages = (input: Record<string, unknown>) => {
  const result = createUserSchema.safeParse({ ...base, ...input });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

const updateResult = (input: Record<string, unknown>) =>
  updateUserSchema.safeParse({ ...base, ...input });

describe("name", () => {
  it("rejects an empty name", () => {
    expect(createMessages({ name: "" })).toEqual(["Name is required"]);
  });

  it("rejects a name over 100 characters", () => {
    expect(createMessages({ name: "a".repeat(101) })).toEqual([
      "Name must be 100 characters or fewer",
    ]);
  });

  it("accepts a name of exactly 100 characters", () => {
    expect(createMessages({ name: "a".repeat(100) })).toEqual([]);
  });
});

describe("email", () => {
  it("trims and lowercases", () => {
    const result = createUserSchema.safeParse({ ...base, email: "  Ani@Example.COM " });
    expect(result.success && result.data.email).toBe("ani@example.com");
  });

  it("rejects an invalid address", () => {
    expect(createMessages({ email: "not-an-email" })).toEqual(["Enter a valid email address"]);
  });
});

describe("password on create", () => {
  it("rejects 7 characters", () => {
    expect(createMessages({ password: "a".repeat(7) })).toEqual([
      "Password must be at least 8 characters",
    ]);
  });

  it("rejects 129 characters", () => {
    expect(createMessages({ password: "a".repeat(129) })).toEqual([
      "Password must be 128 characters or fewer",
    ]);
  });

  it("accepts 8 and 128 characters", () => {
    expect(createMessages({ password: "a".repeat(8) })).toEqual([]);
    expect(createMessages({ password: "a".repeat(128) })).toEqual([]);
  });

  it("is required", () => {
    expect(createMessages({ password: undefined })).not.toEqual([]);
  });
});

describe("password on update", () => {
  it("accepts undefined and produces no password", () => {
    const result = updateResult({ password: undefined });
    expect(result.success).toBe(true);
    expect(result.success && result.data.password).toBeUndefined();
  });

  it("treats an empty string as absent", () => {
    const result = updateResult({ password: "" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.password).toBeUndefined();
  });

  it("accepts 8 characters", () => {
    const result = updateResult({ password: "a".repeat(8) });
    expect(result.success && result.data.password).toBe("a".repeat(8));
  });

  it("rejects 7 characters", () => {
    const result = updateResult({ password: "a".repeat(7) });
    expect(result.success ? [] : result.error.issues.map((i) => i.message)).toEqual([
      "Password must be at least 8 characters",
    ]);
  });
});

describe("role", () => {
  it("rejects an unknown role", () => {
    expect(createMessages({ role: "owner" })).toEqual(["Choose a role"]);
  });
});

describe.each([
  ["create", (input: Record<string, unknown>) => createUserSchema.safeParse({ ...base, ...input }).success],
  ["update", (input: Record<string, unknown>) => updateResult(input).success],
])("scope shape on %s", (_name, ok) => {
  it("rejects ho without a site", () => {
    expect(ok({ role: "ho" })).toBe(false);
  });

  it("rejects ho with a location", () => {
    expect(ok({ role: "ho", siteId: SITE_ID, locationId: LOCATION_ID })).toBe(false);
  });

  it("rejects admin_site without a location", () => {
    expect(ok({ role: "admin_site" })).toBe(false);
  });

  it("rejects admin_site with a site", () => {
    expect(ok({ role: "admin_site", siteId: SITE_ID, locationId: LOCATION_ID })).toBe(false);
  });

  it("rejects superadmin with a site or a location", () => {
    expect(ok({ role: "superadmin", siteId: SITE_ID })).toBe(false);
    expect(ok({ role: "superadmin", locationId: LOCATION_ID })).toBe(false);
  });

  it("accepts each valid combination", () => {
    expect(ok({ role: "superadmin" })).toBe(true);
    expect(ok({ role: "ho", siteId: SITE_ID })).toBe(true);
    expect(ok({ role: "admin_site", locationId: LOCATION_ID })).toBe(true);
  });

  it("rejects a non-uuid site or location", () => {
    expect(ok({ role: "ho", siteId: "x" })).toBe(false);
    expect(ok({ role: "admin_site", locationId: "x" })).toBe(false);
  });
});
