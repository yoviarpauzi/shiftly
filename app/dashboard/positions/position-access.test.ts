import { describe, expect, it } from "vitest";
import { positionAccessFor } from "./position-access";

const LOCATION = "33333333-3333-4333-8333-333333333333";

const user = (fields: { role?: string | null; locationId?: string | null }) => ({
  id: "user-1",
  ...fields,
});

describe("positionAccessFor", () => {
  it("allows HO", () => {
    expect(positionAccessFor(user({ role: "ho" }))).toEqual({ role: "ho" });
  });

  it("rejects HO that also carries a location", () => {
    expect(positionAccessFor(user({ role: "ho", locationId: LOCATION }))).toBeNull();
  });

  it("allows admin site with a location, so it can still write any position", () => {
    expect(positionAccessFor(user({ role: "admin_site", locationId: LOCATION }))).toEqual({
      role: "admin_site",
    });
  });

  it("rejects admin site without a location", () => {
    expect(positionAccessFor(user({ role: "admin_site" }))).toBeNull();
    expect(positionAccessFor(user({ role: "admin_site", locationId: null }))).toBeNull();
  });

  it.each([{ role: null }, { role: undefined }, { role: "guest" }, { role: "superadmin" }])(
    "rejects a user with no allowed role: $role",
    ({ role }) => {
      expect(positionAccessFor(user({ role }))).toBeNull();
    },
  );
});
