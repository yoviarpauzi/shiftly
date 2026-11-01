import { describe, expect, it } from "vitest";
import { locationAccessFor, resolveSiteId } from "./location-access";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION = "33333333-3333-4333-8333-333333333333";

const user = (fields: {
  role?: string | null;
  siteId?: string | null;
  locationId?: string | null;
}) => ({ id: "user-1", ...fields });

describe("locationAccessFor", () => {
  it("gives superadmin every site, even when a site is set", () => {
    expect(locationAccessFor(user({ role: "superadmin", siteId: SITE_A }))).toEqual({
      siteId: null,
    });
  });

  it("limits HO to its own site", () => {
    expect(locationAccessFor(user({ role: "ho", siteId: SITE_A }))).toEqual({
      siteId: SITE_A,
    });
  });

  it("rejects HO without a site", () => {
    expect(locationAccessFor(user({ role: "ho", siteId: null }))).toBeNull();
  });

  it("rejects HO that also has a location set", () => {
    expect(
      locationAccessFor(user({ role: "ho", siteId: SITE_A, locationId: LOCATION })),
    ).toBeNull();
  });

  it("rejects admin site, even with a location set", () => {
    expect(
      locationAccessFor(user({ role: "admin_site", locationId: LOCATION })),
    ).toBeNull();
  });

  it.each([{ role: null }, { role: undefined }, { role: "viewer" }])(
    "rejects a user with no allowed role: $role",
    ({ role }) => {
      expect(locationAccessFor(user({ role, siteId: SITE_A }))).toBeNull();
    },
  );
});

describe("resolveSiteId", () => {
  it("returns the HO's own site for any requested site", () => {
    expect(resolveSiteId({ siteId: SITE_A }, SITE_B)).toBe(SITE_A);
  });

  it("returns the requested site for superadmin", () => {
    expect(resolveSiteId({ siteId: null }, SITE_B)).toBe(SITE_B);
  });
});
