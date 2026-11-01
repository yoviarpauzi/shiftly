import { describe, expect, it } from "vitest";
import { userAccessFor } from "./user-access";

const SITE = "11111111-1111-4111-8111-111111111111";
const LOCATION = "33333333-3333-4333-8333-333333333333";

const user = (fields: {
  role?: string | null;
  siteId?: string | null;
  locationId?: string | null;
}) => ({ id: "user-1", ...fields });

describe("userAccessFor", () => {
  it("gives superadmin every site, even when a site is set", () => {
    expect(userAccessFor(user({ role: "superadmin", siteId: SITE }))).toEqual({
      id: "user-1",
      role: "superadmin",
      siteId: null,
    });
  });

  it("limits HO to its own site", () => {
    expect(userAccessFor(user({ role: "ho", siteId: SITE }))).toEqual({
      id: "user-1",
      role: "ho",
      siteId: SITE,
    });
  });

  it("refuses HO without a site", () => {
    expect(userAccessFor(user({ role: "ho" }))).toBeNull();
  });

  it("refuses HO that also has a location", () => {
    expect(
      userAccessFor(user({ role: "ho", siteId: SITE, locationId: LOCATION })),
    ).toBeNull();
  });

  it("refuses admin site, even with a location", () => {
    expect(
      userAccessFor(user({ role: "admin_site", siteId: SITE, locationId: LOCATION })),
    ).toBeNull();
  });

  it("refuses a null or missing role", () => {
    expect(userAccessFor(user({ role: null }))).toBeNull();
    expect(userAccessFor(user({}))).toBeNull();
  });
});
