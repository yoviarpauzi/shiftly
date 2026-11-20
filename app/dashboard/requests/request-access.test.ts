import { describe, expect, it } from "vitest";
import { canDecideRequest, canWriteToLocation, requestAccessFor } from "./request-access";

const LOCATION_1 = "33333333-3333-4333-8333-333333333333";
const LOCATION_2 = "44444444-4444-4444-8444-444444444444";

const user = (fields: { role?: string | null; locationId?: string | null }) => ({
  id: "user-1",
  ...fields,
});

describe("requestAccessFor", () => {
  it("gives HO every location", () => {
    expect(requestAccessFor(user({ role: "ho" }))).toEqual({ locationId: null });
  });

  it("limits admin site to its location", () => {
    expect(requestAccessFor(user({ role: "admin_site", locationId: LOCATION_1 }))).toEqual({
      locationId: LOCATION_1,
    });
  });

  it("denies HO that also has a location", () => {
    expect(requestAccessFor(user({ role: "ho", locationId: LOCATION_1 }))).toBeNull();
  });

  it("denies admin site without a location", () => {
    expect(requestAccessFor(user({ role: "admin_site" }))).toBeNull();
    expect(requestAccessFor(user({ role: "admin_site", locationId: null }))).toBeNull();
  });

  it("denies an unknown role or no role", () => {
    expect(requestAccessFor(user({ role: "worker" }))).toBeNull();
    expect(requestAccessFor(user({ role: "superadmin" }))).toBeNull();
    expect(requestAccessFor(user({ role: null }))).toBeNull();
    expect(requestAccessFor(user({}))).toBeNull();
  });
});

describe("canWriteToLocation", () => {
  it("lets HO write to any location", () => {
    expect(canWriteToLocation({ locationId: null }, { id: LOCATION_1 })).toBe(true);
    expect(canWriteToLocation({ locationId: null }, { id: LOCATION_2 })).toBe(true);
  });

  it("lets admin site write to its own location only", () => {
    const access = { locationId: LOCATION_1 };

    expect(canWriteToLocation(access, { id: LOCATION_1 })).toBe(true);
    expect(canWriteToLocation(access, { id: LOCATION_2 })).toBe(false);
  });
});

describe("canDecideRequest", () => {
  it("lets HO decide", () => {
    expect(canDecideRequest(user({ role: "ho" }))).toBe(true);
  });

  it("does not let HO with a location decide, matching requestAccessFor", () => {
    expect(canDecideRequest(user({ role: "ho", locationId: LOCATION_1 }))).toBe(false);
  });

  it("does not let admin site decide", () => {
    expect(canDecideRequest(user({ role: "admin_site", locationId: LOCATION_1 }))).toBe(false);
  });

  it("does not let another role or no role decide", () => {
    expect(canDecideRequest(user({ role: "superadmin" }))).toBe(false);
    expect(canDecideRequest(user({}))).toBe(false);
  });
});
