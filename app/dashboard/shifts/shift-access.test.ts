import { describe, expect, it } from "vitest";
import { canWriteToLocation, shiftAccessFor } from "./shift-access";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION = "33333333-3333-4333-8333-333333333333";
const OTHER_LOCATION = "44444444-4444-4444-8444-444444444444";

const user = (fields: {
  role?: string | null;
  siteId?: string | null;
  locationId?: string | null;
}) => ({ id: "user-1", ...fields });

describe("shiftAccessFor", () => {
  it("gives superadmin every site and location, even when a site is set", () => {
    expect(shiftAccessFor(user({ role: "superadmin", siteId: SITE_A }))).toEqual({
      siteId: null,
      locationId: null,
    });
  });

  it("gives superadmin every site and location without a site", () => {
    expect(shiftAccessFor(user({ role: "superadmin" }))).toEqual({
      siteId: null,
      locationId: null,
    });
  });

  it("limits HO to its own site", () => {
    expect(shiftAccessFor(user({ role: "ho", siteId: SITE_A }))).toEqual({
      siteId: SITE_A,
      locationId: null,
    });
  });

  it("rejects HO without a site", () => {
    expect(shiftAccessFor(user({ role: "ho", siteId: null }))).toBeNull();
  });

  it("rejects HO that also carries a location", () => {
    expect(
      shiftAccessFor(user({ role: "ho", siteId: SITE_A, locationId: LOCATION })),
    ).toBeNull();
  });

  it("limits admin site to its own location", () => {
    expect(shiftAccessFor(user({ role: "admin_site", locationId: LOCATION }))).toEqual({
      siteId: null,
      locationId: LOCATION,
    });
  });

  it("rejects admin site without a location", () => {
    expect(shiftAccessFor(user({ role: "admin_site" }))).toBeNull();
  });

  it("rejects a missing role", () => {
    expect(shiftAccessFor(user({ role: null, siteId: SITE_A }))).toBeNull();
  });

  it("rejects an unknown role", () => {
    expect(shiftAccessFor(user({ role: "guest", siteId: SITE_A }))).toBeNull();
  });
});

describe("canWriteToLocation", () => {
  const target = { id: LOCATION, siteId: SITE_A };

  it("lets unrestricted access write anywhere", () => {
    expect(canWriteToLocation({ siteId: null, locationId: null }, target)).toBe(true);
  });

  it("lets a site-bound access write to a location of its own site", () => {
    expect(canWriteToLocation({ siteId: SITE_A, locationId: null }, target)).toBe(true);
  });

  it("stops a site-bound access from writing to a location of another site", () => {
    expect(canWriteToLocation({ siteId: SITE_B, locationId: null }, target)).toBe(false);
  });

  it("lets a location-bound access write to its own location", () => {
    expect(canWriteToLocation({ siteId: null, locationId: LOCATION }, target)).toBe(true);
  });

  it("stops a location-bound access from writing to a tampered other location id", () => {
    expect(canWriteToLocation({ siteId: null, locationId: OTHER_LOCATION }, target)).toBe(false);
  });
});
