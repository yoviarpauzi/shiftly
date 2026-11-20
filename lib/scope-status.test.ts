import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { isScopeActive } from "./scope-status";

const LOCATION = "33333333-3333-4333-8333-333333333333";

const user = (fields: { role?: string | null; locationId?: string | null }) => ({
  id: "user-1",
  ...fields,
});

describe("isScopeActive", () => {
  const active = { locationActive: true };

  it("keeps HO active when it has no location", () => {
    expect(isScopeActive(user({ role: "ho" }), active)).toBe(true);
    expect(isScopeActive(user({ role: "ho" }), { locationActive: false })).toBe(true);
  });

  it("denies HO that is assigned to a location", () => {
    expect(isScopeActive(user({ role: "ho", locationId: "x" }), active)).toBe(false);
  });

  it("keeps admin site active only while its location is active", () => {
    expect(isScopeActive(user({ role: "admin_site", locationId: LOCATION }), active)).toBe(true);
    expect(
      isScopeActive(user({ role: "admin_site", locationId: LOCATION }), { locationActive: false }),
    ).toBe(false);
  });

  it("denies admin site without a location, even when a location is reported active", () => {
    expect(isScopeActive(user({ role: "admin_site", locationId: null }), active)).toBe(false);
    expect(isScopeActive(user({ role: "admin_site" }), active)).toBe(false);
  });

  it("denies superadmin and a null role", () => {
    expect(isScopeActive(user({ role: "superadmin" }), active)).toBe(false);
    expect(isScopeActive(user({ role: null }), active)).toBe(false);
  });
});
