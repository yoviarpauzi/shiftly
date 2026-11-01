import { describe, expect, it } from "vitest";
import { canWriteToLocation, departmentAccessFor } from "./department-access";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION = "33333333-3333-4333-8333-333333333333";
const OTHER_LOCATION = "44444444-4444-4444-8444-444444444444";

const user = (fields: {
  role?: string | null;
  siteId?: string | null;
  locationId?: string | null;
}) => ({ id: "user-1", ...fields });

describe("departmentAccessFor", () => {
  it("gives superadmin every location, even when a site is set", () => {
    expect(departmentAccessFor(user({ role: "superadmin", siteId: SITE_A }))).toEqual({
      siteId: null,
      locationId: null,
    });
  });

  it("gives superadmin every location without a site", () => {
    expect(departmentAccessFor(user({ role: "superadmin" }))).toEqual({
      siteId: null,
      locationId: null,
    });
  });

  it("limits HO to the locations of its own site", () => {
    expect(departmentAccessFor(user({ role: "ho", siteId: SITE_A }))).toEqual({
      siteId: SITE_A,
      locationId: null,
    });
  });

  it("rejects HO without a site", () => {
    expect(departmentAccessFor(user({ role: "ho", siteId: null }))).toBeNull();
  });

  it("rejects HO that also has a location set", () => {
    expect(
      departmentAccessFor(user({ role: "ho", siteId: SITE_A, locationId: LOCATION })),
    ).toBeNull();
  });

  it("limits admin site to its own location", () => {
    expect(
      departmentAccessFor(user({ role: "admin_site", locationId: LOCATION })),
    ).toEqual({ siteId: null, locationId: LOCATION });
  });

  it("takes admin site scope from the location, ignoring a set site", () => {
    expect(
      departmentAccessFor(
        user({ role: "admin_site", siteId: SITE_A, locationId: LOCATION }),
      ),
    ).toEqual({ siteId: null, locationId: LOCATION });
  });

  it("rejects admin site without a location", () => {
    expect(
      departmentAccessFor(user({ role: "admin_site", siteId: SITE_A })),
    ).toBeNull();
  });

  it.each([{ role: null }, { role: undefined }, { role: "viewer" }])(
    "rejects a user with no allowed role: $role",
    ({ role }) => {
      expect(
        departmentAccessFor(user({ role, siteId: SITE_A, locationId: LOCATION })),
      ).toBeNull();
    },
  );
});

describe("canWriteToLocation", () => {
  const location = { id: LOCATION, siteId: SITE_A };

  it("lets superadmin write to any location", () => {
    const access = { siteId: null, locationId: null };
    expect(canWriteToLocation(access, location)).toBe(true);
    expect(canWriteToLocation(access, { id: OTHER_LOCATION, siteId: SITE_B })).toBe(true);
  });

  it("lets HO write to a location of its own site only", () => {
    const access = { siteId: SITE_A, locationId: null };
    expect(canWriteToLocation(access, location)).toBe(true);
    expect(canWriteToLocation(access, { id: OTHER_LOCATION, siteId: SITE_B })).toBe(false);
  });

  it("lets admin site write to its own location only", () => {
    const access = { siteId: null, locationId: LOCATION };
    expect(canWriteToLocation(access, location)).toBe(true);
    expect(canWriteToLocation(access, { id: OTHER_LOCATION, siteId: SITE_A })).toBe(false);
  });
});
