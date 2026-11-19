import { describe, expect, it } from "vitest";
import { canManageBilling } from "./billing-access";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOC_A = "33333333-3333-4333-8333-333333333333";
const LOC_A2 = "44444444-4444-4444-8444-444444444444";
const LOC_B = "55555555-5555-4555-8555-555555555555";

const inLocA = { locationId: LOC_A, siteId: SITE_A };
const inLocA2 = { locationId: LOC_A2, siteId: SITE_A };
const inLocB = { locationId: LOC_B, siteId: SITE_B };

describe("canManageBilling", () => {
  it("lets superadmin manage billings of every location", () => {
    const access = { siteId: null, locationId: null };

    expect(canManageBilling(access, inLocA)).toBe(true);
    expect(canManageBilling(access, inLocA2)).toBe(true);
    expect(canManageBilling(access, inLocB)).toBe(true);
  });

  it("lets HO manage billings of the locations of its site only", () => {
    const access = { siteId: SITE_A, locationId: null };

    expect(canManageBilling(access, inLocA)).toBe(true);
    expect(canManageBilling(access, inLocA2)).toBe(true);
    expect(canManageBilling(access, inLocB)).toBe(false);
  });

  it("lets admin site manage billings of its own location only", () => {
    const access = { siteId: SITE_A, locationId: LOC_A };

    expect(canManageBilling(access, inLocA)).toBe(true);
    expect(canManageBilling(access, inLocA2)).toBe(false);
    expect(canManageBilling(access, inLocB)).toBe(false);
  });
});
