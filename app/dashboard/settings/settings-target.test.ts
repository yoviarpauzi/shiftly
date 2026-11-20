import { describe, expect, it } from "vitest";
import type { SettingsAccess, SettingsLocation, SettingsTargetLoaders } from "@/types/settings";
import { resolveSettingsTarget } from "./settings-target";

const LOCATION_1 = "33333333-3333-4333-8333-333333333333";
const LOCATION_2 = "33333333-3333-4333-8333-444444444444";
const LOCATION_3 = "44444444-4444-4444-8444-444444444444";
const UNKNOWN = "99999999-9999-4999-8999-999999999999";

const HO: SettingsAccess = { userId: "user-2", role: "ho", locationId: null };
const ADMIN_SITE: SettingsAccess = {
  userId: "user-3",
  role: "admin_site",
  locationId: LOCATION_2,
};

// Active rows, already in the order the database returns them (name, then id).
const LOCATIONS: SettingsLocation[] = [
  { id: LOCATION_1, name: "North" },
  { id: LOCATION_2, name: "South" },
  { id: LOCATION_3, name: "West" },
];

// A fake that follows the scoping of settingsLocationChoiceFor (its SQL is pinned in
// settings.test.ts), and counts how often the location list was asked for.
function loaders(locations: SettingsLocation[] = LOCATIONS) {
  const calls: SettingsAccess[] = [];
  const value: SettingsTargetLoaders = {
    locationChoiceFor: async (access) => {
      calls.push(access);

      if (access.role === "admin_site" && access.locationId) {
        const own = locations.find((location) => location.id === access.locationId);

        if (!own) throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");

        return { mode: "fixed", location: own };
      }

      return { mode: "pick", locations };
    },
  };

  return { value, calls };
}

describe("resolveSettingsTarget", () => {
  it("gives an HO the location it asked for", async () => {
    const result = await resolveSettingsTarget(
      HO,
      { scope: "location", location: LOCATION_3 },
      loaders().value,
    );

    expect(result).toMatchObject({
      scope: "location",
      locationId: LOCATION_3,
      empty: null,
      load: { scope: "location", locationId: LOCATION_3 },
    });
    expect(result.locationChoice).toEqual({ mode: "pick", locations: LOCATIONS });
  });

  it.each([
    ["an unknown id", UNKNOWN],
    ["a malformed id", "not-an-id"],
    ["an empty value", ""],
    ["a missing value", undefined],
  ])("falls back to the first active location for %s", async (_, location) => {
    const result = await resolveSettingsTarget(
      HO,
      { scope: "location", location },
      loaders().value,
    );

    expect(result).toMatchObject({
      locationId: LOCATION_1,
      load: { scope: "location", locationId: LOCATION_1 },
    });
  });

  it("reads only the first value of a repeated parameter", async () => {
    const result = await resolveSettingsTarget(
      HO,
      { scope: ["location", "global"], location: [LOCATION_3, LOCATION_2] },
      loaders().value,
    );

    expect(result).toMatchObject({ scope: "location", locationId: LOCATION_3 });
  });

  it("defaults to location level when ?scope= is missing or unknown", async () => {
    const missing = await resolveSettingsTarget(HO, {}, loaders().value);
    const unknown = await resolveSettingsTarget(HO, { scope: "everything" }, loaders().value);

    expect(missing.scope).toBe("location");
    expect(unknown.scope).toBe("location");
  });

  it("has no site level: ?scope=site falls back to location", async () => {
    const result = await resolveSettingsTarget(
      HO,
      { scope: "site", site: UNKNOWN, location: LOCATION_2 },
      loaders().value,
    );

    expect(result).toMatchObject({
      scope: "location",
      locationId: LOCATION_2,
      load: { scope: "location", locationId: LOCATION_2 },
    });
    expect(JSON.stringify(result)).not.toContain("site");
  });

  it.each([
    { location: LOCATION_1 },
    { location: LOCATION_3 },
    { location: UNKNOWN },
    { location: [LOCATION_3, LOCATION_1] },
    {},
  ])(
    "gives an admin site its own fixed location whatever ?location=$location says",
    async (request) => {
      const fakes = loaders();

      const result = await resolveSettingsTarget(
        ADMIN_SITE,
        { scope: "location", ...request },
        fakes.value,
      );

      expect(result).toMatchObject({
        locationId: LOCATION_2,
        load: { scope: "location", locationId: LOCATION_2 },
      });
      expect(result.locationChoice).toEqual({ mode: "fixed", location: LOCATIONS[1] });

      const returned = JSON.stringify(result);

      for (const id of [LOCATION_1, LOCATION_3]) {
        expect(returned).not.toContain(id);
      }
    },
  );

  it("loads the global row with no location and lists no locations at global level", async () => {
    const fakes = loaders();

    const result = await resolveSettingsTarget(
      HO,
      { scope: "global", location: LOCATION_3 },
      fakes.value,
    );

    expect(result).toMatchObject({
      scope: "global",
      locationChoice: null,
      locationId: null,
      empty: null,
      load: { scope: "global", locationId: null },
    });
    expect(fakes.calls).toEqual([]);
  });

  it("lets an admin site open the global level, which it can read", async () => {
    const result = await resolveSettingsTarget(
      ADMIN_SITE,
      { scope: "global" },
      loaders().value,
    );

    expect(result).toMatchObject({ scope: "global", load: { scope: "global", locationId: null } });
  });

  it("loads nothing at location level when there is no active location", async () => {
    const result = await resolveSettingsTarget(
      HO,
      { scope: "location", location: LOCATION_1 },
      loaders([]).value,
    );

    expect(result).toMatchObject({
      scope: "location",
      locationChoice: { mode: "pick", locations: [] },
      locationId: null,
      empty: "no-location",
      load: null,
    });
  });

  it("still loads the global row when there is no active location", async () => {
    const result = await resolveSettingsTarget(HO, { scope: "global" }, loaders([]).value);

    expect(result).toMatchObject({
      scope: "global",
      empty: null,
      load: { scope: "global", locationId: null },
    });
  });
});
