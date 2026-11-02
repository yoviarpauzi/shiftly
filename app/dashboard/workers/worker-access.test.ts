import { describe, expect, it } from "vitest";
import { canWriteWorker, workerAccessFor } from "./worker-access";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";

const user = (fields: {
  role?: string | null;
  siteId?: string | null;
  locationId?: string | null;
}) => ({ id: "user-1", ...fields });

describe("workerAccessFor", () => {
  it("gives superadmin every site and location", () => {
    expect(workerAccessFor(user({ role: "superadmin" }), null)).toEqual({
      siteId: null,
      locationId: null,
    });
  });

  it("limits HO to its own site", () => {
    expect(workerAccessFor(user({ role: "ho", siteId: SITE_A }), null)).toEqual({
      siteId: SITE_A,
      locationId: null,
    });
  });

  it("limits admin site to its own location, inside the site of that location", () => {
    expect(
      workerAccessFor(user({ role: "admin_site", locationId: LOCATION_A }), SITE_A),
    ).toEqual({ siteId: SITE_A, locationId: LOCATION_A });
  });

  it("denies HO without a site, or with a location", () => {
    expect(workerAccessFor(user({ role: "ho" }), null)).toBeNull();
    expect(
      workerAccessFor(user({ role: "ho", siteId: SITE_A, locationId: LOCATION_A }), null),
    ).toBeNull();
  });

  it("denies admin site when its location has no site", () => {
    expect(
      workerAccessFor(user({ role: "admin_site", locationId: LOCATION_A }), null),
    ).toBeNull();
  });

  it("denies other roles", () => {
    expect(workerAccessFor(user({ role: "user" }), null)).toBeNull();
    expect(workerAccessFor(user({ role: null }), null)).toBeNull();
  });
});

describe("canWriteWorker", () => {
  it("lets superadmin write anywhere", () => {
    expect(
      canWriteWorker(
        { siteId: null, locationId: null },
        { siteId: SITE_B, locationId: LOCATION_B },
      ),
    ).toBe(true);
  });

  it("lets HO write to any location of its site only", () => {
    const access = { siteId: SITE_A, locationId: null };

    expect(canWriteWorker(access, { siteId: SITE_A, locationId: LOCATION_B })).toBe(true);
    expect(canWriteWorker(access, { siteId: SITE_B, locationId: LOCATION_B })).toBe(false);
  });

  it("lets admin site write to its own location only", () => {
    const access = { siteId: SITE_A, locationId: LOCATION_A };

    expect(canWriteWorker(access, { siteId: SITE_A, locationId: LOCATION_A })).toBe(true);
    expect(canWriteWorker(access, { siteId: SITE_A, locationId: LOCATION_B })).toBe(false);
  });
});
