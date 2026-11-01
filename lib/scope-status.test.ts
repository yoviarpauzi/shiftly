import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { isScopeActive } from "./scope-status";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const LOCATION = "33333333-3333-4333-8333-333333333333";

const user = (fields: {
  role?: string | null;
  siteId?: string | null;
  locationId?: string | null;
}) => ({ id: "user-1", ...fields });

describe("isScopeActive", () => {
  const active = { siteActive: true, locationActive: true };

  it("keeps superadmin active whatever the site or location state", () => {
    expect(
      isScopeActive(user({ role: "superadmin" }), { siteActive: false, locationActive: false }),
    ).toBe(true);
  });

  it("keeps HO active only while its site is active", () => {
    expect(isScopeActive(user({ role: "ho", siteId: SITE_A }), active)).toBe(true);
    expect(
      isScopeActive(user({ role: "ho", siteId: SITE_A }), { ...active, siteActive: false }),
    ).toBe(false);
  });

  it("keeps admin site active only while its location is active", () => {
    expect(isScopeActive(user({ role: "admin_site", locationId: LOCATION }), active)).toBe(true);
    expect(
      isScopeActive(user({ role: "admin_site", locationId: LOCATION }), {
        ...active,
        locationActive: false,
      }),
    ).toBe(false);
  });

  it("denies HO without a site, even when a site is reported active", () => {
    expect(isScopeActive(user({ role: "ho", siteId: null }), active)).toBe(false);
  });

  it("denies admin site without a location, even when a location is reported active", () => {
    expect(isScopeActive(user({ role: "admin_site", locationId: null }), active)).toBe(false);
  });
});
