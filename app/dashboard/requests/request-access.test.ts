import { describe, expect, it } from "vitest";
import { canDecideRequest, canWriteToLocation, requestAccessFor } from "./request-access";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION_1 = "33333333-3333-4333-8333-333333333333";
const LOCATION_2 = "44444444-4444-4444-8444-444444444444";

const user = (fields: {
  role?: string | null;
  siteId?: string | null;
  locationId?: string | null;
}) => ({ id: "user-1", ...fields });

describe("requestAccessFor", () => {
  it("gives superadmin every site and location, even when a site is set", () => {
    const expected = { siteId: null, locationId: null };

    expect(requestAccessFor(user({ role: "superadmin" }), null)).toEqual(expected);
    expect(requestAccessFor(user({ role: "superadmin", siteId: SITE_A }), null)).toEqual(
      expected,
    );
  });

  it("limits HO to its own site", () => {
    expect(requestAccessFor(user({ role: "ho", siteId: SITE_A }), null)).toEqual({
      siteId: SITE_A,
      locationId: null,
    });
  });

  it("denies HO without a site", () => {
    expect(requestAccessFor(user({ role: "ho" }), null)).toBeNull();
  });

  it("denies HO that also has a location", () => {
    expect(
      requestAccessFor(user({ role: "ho", siteId: SITE_A, locationId: LOCATION_1 }), SITE_A),
    ).toBeNull();
  });

  it("limits admin site to its location and the site that holds it", () => {
    expect(
      requestAccessFor(user({ role: "admin_site", locationId: LOCATION_1 }), SITE_A),
    ).toEqual({ siteId: SITE_A, locationId: LOCATION_1 });
  });

  it("denies admin site when the site id is missing", () => {
    expect(
      requestAccessFor(user({ role: "admin_site", locationId: LOCATION_1 }), null),
    ).toBeNull();
  });

  it("denies admin site without a location", () => {
    expect(requestAccessFor(user({ role: "admin_site" }), SITE_A)).toBeNull();
  });

  it("denies an unknown role or no role", () => {
    expect(requestAccessFor(user({ role: "worker", siteId: SITE_A }), SITE_A)).toBeNull();
    expect(requestAccessFor(user({ role: null }), null)).toBeNull();
    expect(requestAccessFor(user({}), null)).toBeNull();
  });
});

describe("canWriteToLocation", () => {
  const target = { id: LOCATION_1, siteId: SITE_A };

  it("lets superadmin write to any location", () => {
    expect(canWriteToLocation({ siteId: null, locationId: null }, target)).toBe(true);
  });

  it("lets HO write to the locations of its site only", () => {
    const access = { siteId: SITE_A, locationId: null };

    expect(canWriteToLocation(access, target)).toBe(true);
    expect(canWriteToLocation(access, { id: LOCATION_2, siteId: SITE_A })).toBe(true);
    expect(canWriteToLocation(access, { id: LOCATION_2, siteId: SITE_B })).toBe(false);
  });

  it("lets admin site write to its own location only", () => {
    const access = { siteId: SITE_A, locationId: LOCATION_1 };

    expect(canWriteToLocation(access, target)).toBe(true);
    expect(canWriteToLocation(access, { id: LOCATION_2, siteId: SITE_A })).toBe(false);
    expect(canWriteToLocation(access, { id: LOCATION_1, siteId: SITE_B })).toBe(false);
  });
});

describe("canDecideRequest", () => {
  it("lets superadmin decide any request", () => {
    expect(canDecideRequest(user({ role: "superadmin" }), { siteId: SITE_A })).toBe(true);
  });

  it("lets HO decide requests of its own site", () => {
    expect(canDecideRequest(user({ role: "ho", siteId: SITE_A }), { siteId: SITE_A })).toBe(
      true,
    );
  });

  it("does not let HO decide requests of another site", () => {
    expect(canDecideRequest(user({ role: "ho", siteId: SITE_A }), { siteId: SITE_B })).toBe(
      false,
    );
  });

  it("does not let HO without a site decide", () => {
    expect(canDecideRequest(user({ role: "ho" }), { siteId: SITE_A })).toBe(false);
  });

  it("does not let admin site decide", () => {
    expect(
      canDecideRequest(user({ role: "admin_site", siteId: SITE_A, locationId: LOCATION_1 }), {
        siteId: SITE_A,
      }),
    ).toBe(false);
  });

  it("does not let a user without a role decide", () => {
    expect(canDecideRequest(user({ siteId: SITE_A }), { siteId: SITE_A })).toBe(false);
  });
});
