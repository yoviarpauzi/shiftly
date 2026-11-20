import { describe, expect, it } from "vitest";
import { canWriteToLocation, shiftAccessFor } from "./shift-access";

const LOCATION = "33333333-3333-4333-8333-333333333333";
const OTHER_LOCATION = "44444444-4444-4444-8444-444444444444";

const user = (fields: { role?: string | null; locationId?: string | null }) => ({
  id: "user-1",
  ...fields,
});

describe("shiftAccessFor", () => {
  it("gives HO every location", () => {
    expect(shiftAccessFor(user({ role: "ho" }))).toEqual({ locationId: null });
  });

  it("rejects HO that also carries a location", () => {
    expect(shiftAccessFor(user({ role: "ho", locationId: LOCATION }))).toBeNull();
  });

  it("limits admin site to its own location", () => {
    expect(shiftAccessFor(user({ role: "admin_site", locationId: LOCATION }))).toEqual({
      locationId: LOCATION,
    });
  });

  it("rejects admin site without a location", () => {
    expect(shiftAccessFor(user({ role: "admin_site" }))).toBeNull();
    expect(shiftAccessFor(user({ role: "admin_site", locationId: null }))).toBeNull();
  });

  it("rejects a missing role", () => {
    expect(shiftAccessFor(user({ role: null, locationId: LOCATION }))).toBeNull();
  });

  it.each(["guest", "superadmin"])("rejects an unknown or removed role: %s", (role) => {
    expect(shiftAccessFor(user({ role, locationId: LOCATION }))).toBeNull();
    expect(shiftAccessFor(user({ role }))).toBeNull();
  });
});

describe("canWriteToLocation", () => {
  it("lets HO write to any location", () => {
    expect(canWriteToLocation({ locationId: null }, { id: LOCATION })).toBe(true);
    expect(canWriteToLocation({ locationId: null }, { id: OTHER_LOCATION })).toBe(true);
  });

  it("lets admin site write to its own location", () => {
    expect(canWriteToLocation({ locationId: LOCATION }, { id: LOCATION })).toBe(true);
  });

  it("stops admin site from writing to another location", () => {
    expect(canWriteToLocation({ locationId: OTHER_LOCATION }, { id: LOCATION })).toBe(false);
  });
});
