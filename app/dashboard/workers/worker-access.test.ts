import { describe, expect, it } from "vitest";
import { canWriteWorker, workerAccessFor } from "./worker-access";

const LOCATION_A = "33333333-3333-4333-8333-333333333333";
const LOCATION_B = "44444444-4444-4444-8444-444444444444";

const user = (fields: { role?: string | null; locationId?: string | null }) => ({
  id: "user-1",
  ...fields,
});

describe("workerAccessFor", () => {
  it("gives HO every location", () => {
    expect(workerAccessFor(user({ role: "ho" }))).toEqual({ locationId: null });
  });

  it("limits admin site to its own location", () => {
    expect(workerAccessFor(user({ role: "admin_site", locationId: LOCATION_A }))).toEqual({
      locationId: LOCATION_A,
    });
  });

  it("denies HO that carries a location", () => {
    expect(workerAccessFor(user({ role: "ho", locationId: LOCATION_A }))).toBeNull();
  });

  it("denies admin site without a location", () => {
    expect(workerAccessFor(user({ role: "admin_site" }))).toBeNull();
    expect(workerAccessFor(user({ role: "admin_site", locationId: null }))).toBeNull();
  });

  it.each([{ role: "user" }, { role: null }, { role: undefined }, { role: "superadmin" }])(
    "denies a user with no allowed role: $role",
    ({ role }) => {
      expect(workerAccessFor(user({ role }))).toBeNull();
    },
  );
});

describe("canWriteWorker", () => {
  it("lets HO write to any location", () => {
    const access = { locationId: null };

    expect(canWriteWorker(access, { locationId: LOCATION_A })).toBe(true);
    expect(canWriteWorker(access, { locationId: LOCATION_B })).toBe(true);
  });

  it("lets admin site write to its own location", () => {
    expect(canWriteWorker({ locationId: LOCATION_A }, { locationId: LOCATION_A })).toBe(true);
  });

  it("stops admin site from writing a worker at another location", () => {
    expect(canWriteWorker({ locationId: LOCATION_A }, { locationId: LOCATION_B })).toBe(false);
  });
});
