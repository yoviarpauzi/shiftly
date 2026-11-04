import { describe, expect, it } from "vitest";
import type { SiteOption } from "@/types/locations";
import type { SettingsAccess, SettingsLocation, SettingsTargetLoaders } from "@/types/settings";
import { resolveSettingsTarget } from "./settings-target";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const SITE_C = "55555555-5555-4555-8555-555555555555";
const LOCATION_A1 = "33333333-3333-4333-8333-333333333333";
const LOCATION_A2 = "33333333-3333-4333-8333-444444444444";
const LOCATION_B1 = "44444444-4444-4444-8444-444444444444";
const LOCATION_C1 = "66666666-6666-4666-8666-666666666666";
const UNKNOWN = "99999999-9999-4999-8999-999999999999";

const SUPERADMIN: SettingsAccess = {
  userId: "user-1",
  role: "superadmin",
  siteId: null,
  locationId: null,
};
const HO: SettingsAccess = { userId: "user-2", role: "ho", siteId: SITE_A, locationId: null };
const ADMIN_SITE: SettingsAccess = {
  userId: "user-3",
  role: "admin_site",
  siteId: SITE_A,
  locationId: LOCATION_A2,
};

type World = { sites: SiteOption[]; locations: SettingsLocation[] };

// Active rows, already in the order the database returns them (name, then id).
const WORLD: World = {
  sites: [
    { id: SITE_A, name: "Alpha" },
    { id: SITE_B, name: "Beta" },
    { id: SITE_C, name: "Gamma" },
  ],
  locations: [
    { id: LOCATION_A1, name: "A North", siteId: SITE_A },
    { id: LOCATION_A2, name: "A South", siteId: SITE_A },
    { id: LOCATION_B1, name: "B North", siteId: SITE_B },
    { id: LOCATION_C1, name: "C North", siteId: SITE_C },
  ],
};

// Fakes that follow the scoping of settingsSiteChoiceFor and settingsLocationChoiceFor (their
// SQL is pinned in settings.test.ts), and record the site every location list was asked for.
function loaders(world: World = WORLD) {
  const locationCalls: string[] = [];
  const value: SettingsTargetLoaders = {
    siteChoiceFor: async (access) => {
      if (access.siteId) {
        const own = world.sites.find((site) => site.id === access.siteId);

        if (!own) throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");

        return { mode: "fixed", site: own };
      }

      return { mode: "pick", sites: world.sites };
    },
    locationChoiceFor: async (access, siteId) => {
      locationCalls.push(siteId);

      if (access.role === "admin_site" && access.locationId) {
        const own = world.locations.find((location) => location.id === access.locationId);

        if (!own) throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");

        return { mode: "fixed", location: own };
      }

      if (access.siteId && access.siteId !== siteId) {
        return { mode: "pick", locations: [] };
      }

      return {
        mode: "pick",
        locations: world.locations.filter((location) => location.siteId === siteId),
      };
    },
  };

  return { value, locationCalls };
}

describe("resolveSettingsTarget", () => {
  it("gives a superadmin the site and location it asked for", async () => {
    const fakes = loaders();

    const result = await resolveSettingsTarget(
      SUPERADMIN,
      { scope: "location", site: SITE_B, location: LOCATION_B1 },
      fakes.value,
    );

    expect(result).toMatchObject({
      scope: "location",
      siteId: SITE_B,
      locationId: LOCATION_B1,
      empty: null,
      load: { scope: "location", siteId: SITE_B, locationId: LOCATION_B1 },
    });
    expect(result.siteChoice).toEqual({ mode: "pick", sites: WORLD.sites });
    expect(result.locationChoice).toEqual({
      mode: "pick",
      locations: [WORLD.locations[2]],
    });
    expect(fakes.locationCalls).toEqual([SITE_B]);
  });

  it("gives a superadmin the first location of the site when ?location= is not in it", async () => {
    const result = await resolveSettingsTarget(
      SUPERADMIN,
      { scope: "location", site: SITE_B, location: LOCATION_A1 },
      loaders().value,
    );

    expect(result).toMatchObject({ siteId: SITE_B, locationId: LOCATION_B1 });
  });

  it.each([
    ["an unknown id", UNKNOWN],
    ["a malformed id", "not-an-id"],
    ["an empty value", ""],
    ["a missing value", undefined],
  ])("falls back to the first active site and its first location for %s", async (_, site) => {
    const result = await resolveSettingsTarget(
      SUPERADMIN,
      { scope: "location", site, location: site },
      loaders().value,
    );

    expect(result).toMatchObject({
      siteId: SITE_A,
      locationId: LOCATION_A1,
      load: { scope: "location", siteId: SITE_A, locationId: LOCATION_A1 },
    });
  });

  it("reads only the first value of a repeated parameter", async () => {
    const result = await resolveSettingsTarget(
      SUPERADMIN,
      { scope: ["site", "global"], site: [SITE_C, SITE_B] },
      loaders().value,
    );

    expect(result).toMatchObject({
      scope: "site",
      siteId: SITE_C,
      load: { scope: "site", siteId: SITE_C, locationId: null },
    });
  });

  it("defaults to location level when ?scope= is missing or unknown", async () => {
    const missing = await resolveSettingsTarget(SUPERADMIN, {}, loaders().value);
    const unknown = await resolveSettingsTarget(
      SUPERADMIN,
      { scope: "everything" },
      loaders().value,
    );

    expect(missing.scope).toBe("location");
    expect(unknown.scope).toBe("location");
  });

  const foreignRequests = [
    { site: SITE_B, location: LOCATION_B1 },
    { site: SITE_C, location: LOCATION_C1 },
    { site: SITE_B, location: LOCATION_C1 },
    { site: [SITE_B, SITE_A], location: [LOCATION_B1, LOCATION_A2] },
    { site: SITE_A, location: LOCATION_B1 },
    { site: UNKNOWN, location: LOCATION_C1 },
  ];
  const foreignIds = [SITE_B, SITE_C, LOCATION_B1, LOCATION_C1];

  it.each(foreignRequests)(
    "keeps an HO on its own site and its first location for ?site=$site&location=$location",
    async (request) => {
      const fakes = loaders();

      const result = await resolveSettingsTarget(
        HO,
        { scope: "location", ...request },
        fakes.value,
      );

      expect(result).toMatchObject({
        siteId: SITE_A,
        locationId: LOCATION_A1,
        load: { scope: "location", siteId: SITE_A, locationId: LOCATION_A1 },
      });
      expect(result.siteChoice).toEqual({ mode: "fixed", site: WORLD.sites[0] });
      expect(fakes.locationCalls).toEqual([SITE_A]);

      const returned = JSON.stringify(result);

      for (const id of foreignIds) {
        expect(returned).not.toContain(id);
      }
    },
  );

  it.each(["site", "global"] as const)(
    "keeps an HO on its own site at %s level whatever ?site= says",
    async (scope) => {
      const fakes = loaders();

      const result = await resolveSettingsTarget(
        HO,
        { scope, site: SITE_B, location: LOCATION_B1 },
        fakes.value,
      );

      expect(result.siteId).toBe(SITE_A);
      expect(fakes.locationCalls).toEqual([]);

      const returned = JSON.stringify(result);

      for (const id of foreignIds) {
        expect(returned).not.toContain(id);
      }
    },
  );

  it("gives an HO a location of its own site that it asked for", async () => {
    const result = await resolveSettingsTarget(
      HO,
      { scope: "location", location: LOCATION_A2 },
      loaders().value,
    );

    expect(result).toMatchObject({ siteId: SITE_A, locationId: LOCATION_A2 });
  });

  it.each(foreignRequests)(
    "gives an admin site its own fixed site and location for ?site=$site&location=$location",
    async (request) => {
      const fakes = loaders();

      const result = await resolveSettingsTarget(
        ADMIN_SITE,
        { scope: "location", ...request },
        fakes.value,
      );

      expect(result).toMatchObject({
        siteId: SITE_A,
        locationId: LOCATION_A2,
        load: { scope: "location", siteId: SITE_A, locationId: LOCATION_A2 },
      });
      expect(result.siteChoice).toEqual({ mode: "fixed", site: WORLD.sites[0] });
      expect(result.locationChoice).toEqual({ mode: "fixed", location: WORLD.locations[1] });
      expect(fakes.locationCalls).toEqual([SITE_A]);
    },
  );

  it("loads the global row with no ids and lists no locations at global level", async () => {
    const fakes = loaders();

    const result = await resolveSettingsTarget(
      SUPERADMIN,
      { scope: "global", site: SITE_B, location: LOCATION_B1 },
      fakes.value,
    );

    expect(result).toMatchObject({
      scope: "global",
      siteId: SITE_B,
      locationChoice: null,
      locationId: null,
      empty: null,
      load: { scope: "global", siteId: null, locationId: null },
    });
    expect(fakes.locationCalls).toEqual([]);
  });

  it("loads the site row with no location at site level", async () => {
    const fakes = loaders();

    const result = await resolveSettingsTarget(
      SUPERADMIN,
      { scope: "site", site: SITE_B, location: LOCATION_B1 },
      fakes.value,
    );

    expect(result).toMatchObject({
      scope: "site",
      siteId: SITE_B,
      locationChoice: null,
      locationId: null,
      load: { scope: "site", siteId: SITE_B, locationId: null },
    });
    expect(fakes.locationCalls).toEqual([]);
  });

  it.each(["global", "site", "location"] as const)(
    "loads nothing at %s level when there is no active site",
    async (scope) => {
      const fakes = loaders({ sites: [], locations: [] });

      const result = await resolveSettingsTarget(
        SUPERADMIN,
        { scope, site: SITE_A },
        fakes.value,
      );

      expect(result).toMatchObject({
        scope,
        siteChoice: { mode: "pick", sites: [] },
        siteId: null,
        locationChoice: null,
        locationId: null,
        empty: "no-site",
        load: null,
      });
      expect(fakes.locationCalls).toEqual([]);
    },
  );

  it("loads nothing at location level when the site has no active location", async () => {
    const result = await resolveSettingsTarget(
      SUPERADMIN,
      { scope: "location", site: SITE_A },
      loaders({ sites: WORLD.sites, locations: [] }).value,
    );

    expect(result).toMatchObject({
      siteId: SITE_A,
      locationChoice: { mode: "pick", locations: [] },
      locationId: null,
      empty: "no-location",
      load: null,
    });
  });
});
