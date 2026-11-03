import { describe, expect, it } from "vitest";

import { canAccessRosterLocation, rosterAccessFor } from "./roster-access";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION_1 = "33333333-3333-4333-8333-333333333333";
const LOCATION_2 = "44444444-4444-4444-8444-444444444444";

const user = (fields: {
  role?: string | null;
  siteId?: string | null;
  locationId?: string | null;
}) => ({ id: "user-1", ...fields });

describe("rosterAccessFor", () => {
  it("gives superadmin every site and location", () => {
    expect(rosterAccessFor(user({ role: "superadmin" }), null)).toEqual({
      siteId: null,
      locationId: null,
    });
  });

  it("limits HO to its own site", () => {
    expect(rosterAccessFor(user({ role: "ho", siteId: SITE_A }), null)).toEqual({
      siteId: SITE_A,
      locationId: null,
    });
  });

  it("limits admin site to its location and the site that holds it", () => {
    expect(
      rosterAccessFor(user({ role: "admin_site", locationId: LOCATION_1 }), SITE_A),
    ).toEqual({ siteId: SITE_A, locationId: LOCATION_1 });
  });

  it("denies HO without a site, HO with a location, and admin site without its site", () => {
    expect(rosterAccessFor(user({ role: "ho" }), null)).toBeNull();
    expect(
      rosterAccessFor(user({ role: "ho", siteId: SITE_A, locationId: LOCATION_1 }), SITE_A),
    ).toBeNull();
    expect(
      rosterAccessFor(user({ role: "admin_site", locationId: LOCATION_1 }), null),
    ).toBeNull();
  });

  it("denies an unknown role and a missing role", () => {
    expect(rosterAccessFor(user({ role: "user" }), null)).toBeNull();
    expect(rosterAccessFor(user({ role: null }), null)).toBeNull();
  });
});

describe("canAccessRosterLocation", () => {
  it("lets superadmin reach any location", () => {
    expect(
      canAccessRosterLocation({ siteId: null, locationId: null }, { id: LOCATION_2, siteId: SITE_B }),
    ).toBe(true);
  });

  it("lets HO reach a location of its site and no other", () => {
    const access = { siteId: SITE_A, locationId: null };

    expect(canAccessRosterLocation(access, { id: LOCATION_1, siteId: SITE_A })).toBe(true);
    expect(canAccessRosterLocation(access, { id: LOCATION_2, siteId: SITE_B })).toBe(false);
  });

  it("lets admin site reach its own location and no other, even in the same site", () => {
    const access = { siteId: SITE_A, locationId: LOCATION_1 };

    expect(canAccessRosterLocation(access, { id: LOCATION_1, siteId: SITE_A })).toBe(true);
    expect(canAccessRosterLocation(access, { id: LOCATION_2, siteId: SITE_A })).toBe(false);
  });
});
