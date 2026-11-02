import { describe, expect, it } from "vitest";
import { canWriteToSite, shiftAccessFor } from "./shift-access";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION = "33333333-3333-4333-8333-333333333333";

const user = (fields: {
  role?: string | null;
  siteId?: string | null;
  locationId?: string | null;
}) => ({ id: "user-1", ...fields });

describe("shiftAccessFor", () => {
  it("gives superadmin every site, even when a site is set", () => {
    expect(shiftAccessFor(user({ role: "superadmin", siteId: SITE_A }), null)).toEqual({
      siteId: null,
    });
  });

  it("gives superadmin every site without a site", () => {
    expect(shiftAccessFor(user({ role: "superadmin" }), null)).toEqual({ siteId: null });
  });

  it("limits HO to its own site", () => {
    expect(shiftAccessFor(user({ role: "ho", siteId: SITE_A }), null)).toEqual({
      siteId: SITE_A,
    });
  });

  it("rejects HO without a site", () => {
    expect(shiftAccessFor(user({ role: "ho", siteId: null }), null)).toBeNull();
  });

  it("rejects HO that also carries a location", () => {
    expect(
      shiftAccessFor(user({ role: "ho", siteId: SITE_A, locationId: LOCATION }), SITE_A),
    ).toBeNull();
  });

  it("gives admin site the site of its location", () => {
    expect(shiftAccessFor(user({ role: "admin_site", locationId: LOCATION }), SITE_A)).toEqual({
      siteId: SITE_A,
    });
  });

  it("rejects admin site whose location has no resolvable site", () => {
    expect(shiftAccessFor(user({ role: "admin_site", locationId: LOCATION }), null)).toBeNull();
  });

  it("rejects admin site without a location", () => {
    expect(shiftAccessFor(user({ role: "admin_site" }), SITE_A)).toBeNull();
  });

  it("rejects a missing role", () => {
    expect(shiftAccessFor(user({ role: null, siteId: SITE_A }), null)).toBeNull();
  });

  it("rejects an unknown role", () => {
    expect(shiftAccessFor(user({ role: "guest", siteId: SITE_A }), null)).toBeNull();
  });
});

describe("canWriteToSite", () => {
  it("lets access to every site write anywhere", () => {
    expect(canWriteToSite({ siteId: null }, SITE_B)).toBe(true);
  });

  it("lets a site-bound access write to its own site", () => {
    expect(canWriteToSite({ siteId: SITE_A }, SITE_A)).toBe(true);
  });

  it("stops a site-bound access from writing to a tampered other site id", () => {
    expect(canWriteToSite({ siteId: SITE_A }, SITE_B)).toBe(false);
  });
});
