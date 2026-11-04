import { describe, expect, it } from "vitest";

import { attendanceAccessFor, canAccessAttendanceLocation } from "./attendance-access";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";

const user = (fields: {
  role?: string | null;
  siteId?: string | null;
  locationId?: string | null;
}) => ({ id: "user-1", ...fields });

describe("attendanceAccessFor", () => {
  it("gives superadmin every site and location", () => {
    expect(attendanceAccessFor(user({ role: "superadmin" }), null)).toEqual({
      userId: "user-1",
      role: "superadmin",
      siteId: null,
      locationId: null,
    });
  });

  it("limits HO to its own site", () => {
    expect(attendanceAccessFor(user({ role: "ho", siteId: SITE_A }), null)).toEqual({
      userId: "user-1",
      role: "ho",
      siteId: SITE_A,
      locationId: null,
    });
  });

  it("limits admin site to its own location, inside the site of that location", () => {
    expect(
      attendanceAccessFor(user({ role: "admin_site", locationId: LOCATION_A }), SITE_A),
    ).toEqual({
      userId: "user-1",
      role: "admin_site",
      siteId: SITE_A,
      locationId: LOCATION_A,
    });
  });

  it("denies HO without a site, or with a location", () => {
    expect(attendanceAccessFor(user({ role: "ho" }), null)).toBeNull();
    expect(
      attendanceAccessFor(user({ role: "ho", siteId: SITE_A, locationId: LOCATION_A }), null),
    ).toBeNull();
  });

  it("denies admin site without a location, or when its location has no site", () => {
    expect(attendanceAccessFor(user({ role: "admin_site" }), SITE_A)).toBeNull();
    expect(
      attendanceAccessFor(user({ role: "admin_site", locationId: LOCATION_A }), null),
    ).toBeNull();
  });

  it("denies an unknown role and a missing role", () => {
    expect(attendanceAccessFor(user({ role: "user" }), null)).toBeNull();
    expect(attendanceAccessFor(user({ role: null }), null)).toBeNull();
  });
});

describe("canAccessAttendanceLocation", () => {
  const superadmin = attendanceAccessFor(user({ role: "superadmin" }), null)!;
  const ho = attendanceAccessFor(user({ role: "ho", siteId: SITE_A }), null)!;
  const adminSite = attendanceAccessFor(
    user({ role: "admin_site", locationId: LOCATION_A }),
    SITE_A,
  )!;

  it("lets superadmin reach any location", () => {
    expect(canAccessAttendanceLocation(superadmin, { id: LOCATION_B, siteId: SITE_B })).toBe(true);
  });

  it("lets HO reach a location of its site and no other", () => {
    expect(canAccessAttendanceLocation(ho, { id: LOCATION_A, siteId: SITE_A })).toBe(true);
    expect(canAccessAttendanceLocation(ho, { id: LOCATION_B, siteId: SITE_B })).toBe(false);
  });

  it("lets admin site reach its own location and no other, even in the same site", () => {
    expect(canAccessAttendanceLocation(adminSite, { id: LOCATION_A, siteId: SITE_A })).toBe(true);
    expect(canAccessAttendanceLocation(adminSite, { id: LOCATION_B, siteId: SITE_A })).toBe(false);
  });
});
