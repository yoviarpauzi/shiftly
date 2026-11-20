import { describe, expect, it } from "vitest";
import { dashboardAccessFor } from "./dashboard-access";

const LOCATION_A = "33333333-3333-4333-8333-333333333333";

describe("dashboardAccessFor", () => {
  it("gives an HO without a location every location", () => {
    expect(dashboardAccessFor({ id: "u1", role: "ho", locationId: null })).toEqual({
      role: "ho",
      access: { locationId: null },
    });
    expect(dashboardAccessFor({ id: "u1", role: "ho" })).toEqual({
      role: "ho",
      access: { locationId: null },
    });
  });

  it("gives an admin site its own location", () => {
    expect(dashboardAccessFor({ id: "u2", role: "admin_site", locationId: LOCATION_A })).toEqual({
      role: "admin_site",
      access: { locationId: LOCATION_A },
    });
  });

  it("gives no access to an HO that carries a location", () => {
    expect(dashboardAccessFor({ id: "u1", role: "ho", locationId: LOCATION_A })).toBeNull();
  });

  it("gives no access to an admin site without a location", () => {
    expect(dashboardAccessFor({ id: "u2", role: "admin_site", locationId: null })).toBeNull();
    expect(dashboardAccessFor({ id: "u2", role: "admin_site" })).toBeNull();
  });

  it("gives no access to a rejected role or no role", () => {
    expect(dashboardAccessFor({ id: "u3", role: "superadmin", locationId: null })).toBeNull();
    expect(dashboardAccessFor({ id: "u3", role: null })).toBeNull();
    expect(dashboardAccessFor({ id: "u3" })).toBeNull();
  });
});
