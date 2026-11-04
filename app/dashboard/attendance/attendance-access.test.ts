import { describe, expect, it } from "vitest";

import {
  attendanceAccessFor,
  attendanceScope,
  canAccessAttendanceLocation,
} from "./attendance-access";

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

describe("attendanceScope", () => {
  const LOCATION_C = "55555555-5555-4555-8555-555555555555";
  const superadmin = attendanceAccessFor(user({ role: "superadmin" }), null)!;
  const ho = attendanceAccessFor(user({ role: "ho", siteId: SITE_A }), null)!;
  const adminSite = attendanceAccessFor(
    user({ role: "admin_site", locationId: LOCATION_A }),
    SITE_A,
  )!;

  const place = (id: string, siteId: string) => ({
    id,
    name: id,
    siteId,
    timezone: "Asia/Jakarta" as const,
  });
  const locations = [
    place(LOCATION_A, SITE_A),
    place(LOCATION_C, SITE_A),
    place(LOCATION_B, SITE_B),
  ];
  const choice = (siteId: string | null, locationId: string | null) => ({
    siteId,
    locationId,
    locations,
  });

  it("superadmin on All sites gets every location", () => {
    expect(attendanceScope(superadmin, choice(null, null))).toEqual([
      LOCATION_A,
      LOCATION_C,
      LOCATION_B,
    ]);
  });

  it("a chosen site limits it to that site's locations", () => {
    expect(attendanceScope(superadmin, choice(SITE_A, null))).toEqual([LOCATION_A, LOCATION_C]);
  });

  it("a chosen location gives only that location", () => {
    expect(attendanceScope(superadmin, choice(SITE_A, LOCATION_C))).toEqual([LOCATION_C]);
  });

  it("HO never gets a location of another site, even if the list holds one", () => {
    expect(attendanceScope(ho, choice(null, null))).toEqual([LOCATION_A, LOCATION_C]);
    expect(attendanceScope(ho, choice(SITE_B, null))).toEqual([]);
  });

  it("admin site gets only its own location even if the list holds two", () => {
    expect(attendanceScope(adminSite, choice(SITE_A, null))).toEqual([LOCATION_A]);
  });

  it("a chosen location outside the access gives an empty list", () => {
    expect(attendanceScope(adminSite, choice(SITE_A, LOCATION_C))).toEqual([]);
    expect(attendanceScope(ho, choice(SITE_B, LOCATION_B))).toEqual([]);
  });

  it("no locations gives an empty list", () => {
    expect(attendanceScope(superadmin, { siteId: null, locationId: null, locations: [] })).toEqual(
      [],
    );
  });
});
