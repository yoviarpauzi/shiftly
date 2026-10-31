import { describe, expect, it } from "vitest";
import { canDeleteSite, isSiteNameConflict } from "./site-rules";

describe("canDeleteSite", () => {
  it("allows deleting a site with no locations and no users", () => {
    expect(canDeleteSite({ activeLocations: 0, assignedUsers: 0 })).toEqual({
      ok: true,
    });
  });

  it("blocks deleting a site with one active location", () => {
    const result = canDeleteSite({ activeLocations: 1, assignedUsers: 0 });

    expect(result.ok).toBe(false);
    expect(result).toHaveProperty("formError");
    expect((result as { formError: string }).formError).toContain(
      "1 active location",
    );
  });

  it("names both counts when the site has locations and users", () => {
    expect(canDeleteSite({ activeLocations: 2, assignedUsers: 1 })).toEqual({
      ok: false,
      formError:
        "This site has 2 active locations and 1 HO user assigned. Move them first.",
    });
  });

  it("blocks deleting a site that still has HO users assigned", () => {
    const result = canDeleteSite({ activeLocations: 0, assignedUsers: 3 });

    expect(result.ok).toBe(false);
    expect((result as { formError: string }).formError).toContain(
      "3 HO users assigned",
    );
  });
});

describe("isSiteNameConflict", () => {
  it("detects the active-name unique violation", () => {
    expect(
      isSiteNameConflict({
        code: "23505",
        constraint: "site_name_lower_active_unique",
      }),
    ).toBe(true);
  });

  it("detects the violation when it is wrapped in a cause", () => {
    expect(
      isSiteNameConflict({
        cause: {
          code: "23505",
          constraint: "site_name_lower_active_unique",
        },
      }),
    ).toBe(true);
  });

  it("ignores a unique violation on another constraint", () => {
    expect(
      isSiteNameConflict({
        code: "23505",
        constraint: "location_siteId_name_active_unique",
      }),
    ).toBe(false);
  });

  it("ignores a foreign key violation", () => {
    expect(
      isSiteNameConflict({
        code: "23503",
        constraint: "site_name_lower_active_unique",
      }),
    ).toBe(false);
  });

  it("returns false for a non-object error", () => {
    expect(isSiteNameConflict(null)).toBe(false);
  });
});
