import { describe, expect, it } from "vitest";
import { canWriteToLocation, departmentAccessFor } from "./department-access";

const LOCATION = "33333333-3333-4333-8333-333333333333";
const OTHER_LOCATION = "44444444-4444-4444-8444-444444444444";

const user = (fields: { role?: string | null; locationId?: string | null }) => ({
  id: "user-1",
  ...fields,
});

describe("departmentAccessFor", () => {
  it("gives HO every location", () => {
    expect(departmentAccessFor(user({ role: "ho" }))).toEqual({ locationId: null });
  });

  it("rejects HO that also has a location set", () => {
    expect(departmentAccessFor(user({ role: "ho", locationId: LOCATION }))).toBeNull();
  });

  it("limits admin site to its own location", () => {
    expect(departmentAccessFor(user({ role: "admin_site", locationId: LOCATION }))).toEqual({
      locationId: LOCATION,
    });
  });

  it("rejects admin site without a location", () => {
    expect(departmentAccessFor(user({ role: "admin_site" }))).toBeNull();
    expect(departmentAccessFor(user({ role: "admin_site", locationId: null }))).toBeNull();
  });

  it.each([{ role: null }, { role: undefined }, { role: "viewer" }, { role: "superadmin" }])(
    "rejects a user with no allowed role: $role",
    ({ role }) => {
      expect(departmentAccessFor(user({ role, locationId: LOCATION }))).toBeNull();
      expect(departmentAccessFor(user({ role }))).toBeNull();
    },
  );
});

describe("canWriteToLocation", () => {
  it("lets HO write to any location", () => {
    const access = { locationId: null };
    expect(canWriteToLocation(access, { id: LOCATION })).toBe(true);
    expect(canWriteToLocation(access, { id: OTHER_LOCATION })).toBe(true);
  });

  it("lets admin site write to its own location only", () => {
    const access = { locationId: LOCATION };
    expect(canWriteToLocation(access, { id: LOCATION })).toBe(true);
    expect(canWriteToLocation(access, { id: OTHER_LOCATION })).toBe(false);
  });
});
