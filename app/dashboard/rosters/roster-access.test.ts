import { describe, expect, it } from "vitest";

import { canAccessRosterLocation, rosterAccessFor } from "./roster-access";

const LOCATION_1 = "33333333-3333-4333-8333-333333333333";
const LOCATION_2 = "44444444-4444-4444-8444-444444444444";

const user = (fields: { role?: string | null; locationId?: string | null }) => ({
  id: "user-1",
  ...fields,
});

describe("rosterAccessFor", () => {
  it("gives HO every location", () => {
    expect(rosterAccessFor(user({ role: "ho" }))).toEqual({ locationId: null });
  });

  it("limits admin site to its location", () => {
    expect(rosterAccessFor(user({ role: "admin_site", locationId: LOCATION_1 }))).toEqual({
      locationId: LOCATION_1,
    });
  });

  it("denies HO with a location and admin site without one", () => {
    expect(rosterAccessFor(user({ role: "ho", locationId: LOCATION_1 }))).toBeNull();
    expect(rosterAccessFor(user({ role: "admin_site" }))).toBeNull();
    expect(rosterAccessFor(user({ role: "admin_site", locationId: null }))).toBeNull();
  });

  it("denies an unknown role, the retired superadmin role, and a missing role", () => {
    expect(rosterAccessFor(user({ role: "user" }))).toBeNull();
    expect(rosterAccessFor(user({ role: "superadmin" }))).toBeNull();
    expect(rosterAccessFor(user({ role: null }))).toBeNull();
  });
});

describe("canAccessRosterLocation", () => {
  it("lets HO reach any location", () => {
    const access = { locationId: null };

    expect(canAccessRosterLocation(access, { id: LOCATION_1 })).toBe(true);
    expect(canAccessRosterLocation(access, { id: LOCATION_2 })).toBe(true);
  });

  it("lets admin site reach its own location and no other", () => {
    const access = { locationId: LOCATION_1 };

    expect(canAccessRosterLocation(access, { id: LOCATION_1 })).toBe(true);
    expect(canAccessRosterLocation(access, { id: LOCATION_2 })).toBe(false);
  });
});
