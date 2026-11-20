import { describe, expect, it } from "vitest";
import { locationAccessFor } from "./location-access";

const LOCATION = "33333333-3333-4333-8333-333333333333";

const user = (fields: { role?: string | null; locationId?: string | null }) => ({
  id: "user-1",
  ...fields,
});

describe("locationAccessFor", () => {
  it("allows HO", () => {
    expect(locationAccessFor(user({ role: "ho" }))).not.toBeNull();
  });

  it("gives HO an access that carries no site", () => {
    expect(locationAccessFor(user({ role: "ho" }))).toEqual({ role: "ho" });
  });

  it("rejects HO that has a location set", () => {
    expect(locationAccessFor(user({ role: "ho", locationId: LOCATION }))).toBeNull();
  });

  it("rejects admin site, even with a location set", () => {
    expect(
      locationAccessFor(user({ role: "admin_site", locationId: LOCATION })),
    ).toBeNull();
  });

  it.each([
    { role: null },
    { role: undefined },
    { role: "viewer" },
    { role: "superadmin" },
  ])("rejects a user with no allowed role: $role", ({ role }) => {
    expect(locationAccessFor(user({ role }))).toBeNull();
  });
});
