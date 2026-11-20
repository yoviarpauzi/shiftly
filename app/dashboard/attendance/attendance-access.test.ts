import { describe, expect, it } from "vitest";

import {
  attendanceAccessFor,
  attendanceScope,
  canAccessAttendanceLocation,
} from "./attendance-access";

const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";

const user = (fields: { role?: string | null; locationId?: string | null }) => ({
  id: "user-1",
  ...fields,
});

describe("attendanceAccessFor", () => {
  it("gives HO every location", () => {
    expect(attendanceAccessFor(user({ role: "ho" }))).toEqual({
      userId: "user-1",
      role: "ho",
      locationId: null,
    });
  });

  it("limits admin site to its own location", () => {
    expect(attendanceAccessFor(user({ role: "admin_site", locationId: LOCATION_A }))).toEqual({
      userId: "user-1",
      role: "admin_site",
      locationId: LOCATION_A,
    });
  });

  it("denies HO with a location", () => {
    expect(attendanceAccessFor(user({ role: "ho", locationId: LOCATION_A }))).toBeNull();
  });

  it("denies admin site without a location", () => {
    expect(attendanceAccessFor(user({ role: "admin_site" }))).toBeNull();
    expect(attendanceAccessFor(user({ role: "admin_site", locationId: null }))).toBeNull();
  });

  it("denies an unknown role, the retired superadmin role, and a missing role", () => {
    expect(attendanceAccessFor(user({ role: "user" }))).toBeNull();
    expect(attendanceAccessFor(user({ role: "superadmin" }))).toBeNull();
    expect(attendanceAccessFor(user({ role: null }))).toBeNull();
  });
});

describe("canAccessAttendanceLocation", () => {
  const ho = attendanceAccessFor(user({ role: "ho" }))!;
  const adminSite = attendanceAccessFor(user({ role: "admin_site", locationId: LOCATION_A }))!;

  it("lets HO reach any location", () => {
    expect(canAccessAttendanceLocation(ho, { id: LOCATION_A })).toBe(true);
    expect(canAccessAttendanceLocation(ho, { id: LOCATION_B })).toBe(true);
  });

  it("lets admin site reach its own location and no other", () => {
    expect(canAccessAttendanceLocation(adminSite, { id: LOCATION_A })).toBe(true);
    expect(canAccessAttendanceLocation(adminSite, { id: LOCATION_B })).toBe(false);
  });
});

describe("attendanceScope", () => {
  const LOCATION_C = "55555555-5555-4555-8555-555555555555";
  const ho = attendanceAccessFor(user({ role: "ho" }))!;
  const adminSite = attendanceAccessFor(user({ role: "admin_site", locationId: LOCATION_A }))!;

  const place = (id: string) => ({ id, name: id, timezone: "Asia/Jakarta" as const });
  const locations = [place(LOCATION_A), place(LOCATION_C), place(LOCATION_B)];
  const choice = (locationId: string | null) => ({ locationId, locations });

  it("HO on All locations gets every location", () => {
    expect(attendanceScope(ho, choice(null))).toEqual([LOCATION_A, LOCATION_C, LOCATION_B]);
  });

  it("a chosen location gives only that location", () => {
    expect(attendanceScope(ho, choice(LOCATION_C))).toEqual([LOCATION_C]);
  });

  it("admin site gets only its own location even if the list holds three", () => {
    expect(attendanceScope(adminSite, choice(null))).toEqual([LOCATION_A]);
  });

  it("a chosen location outside the access gives an empty list", () => {
    expect(attendanceScope(adminSite, choice(LOCATION_C))).toEqual([]);
  });

  it("no locations gives an empty list", () => {
    expect(attendanceScope(ho, { locationId: null, locations: [] })).toEqual([]);
  });
});
