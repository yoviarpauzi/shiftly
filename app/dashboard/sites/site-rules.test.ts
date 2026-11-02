import { describe, expect, it } from "vitest";
import type { SiteRow } from "@/types/sites";
import {
  bulkRestoreMessage,
  bulkSelectionMode,
  canDeleteSite,
  isSiteNameConflict,
} from "./site-rules";

const site = (deleted: boolean): SiteRow => ({
  id: crypto.randomUUID(),
  name: "Nestle",
  locationCount: 0,
  deletedAt: deleted ? new Date() : null,
});

describe("bulkSelectionMode", () => {
  it("is none when nothing is selected", () => {
    expect(bulkSelectionMode([])).toBe("none");
  });

  it("is active when every selected site is active", () => {
    expect(bulkSelectionMode([site(false), site(false)])).toBe("active");
  });

  it("is deleted when every selected site is deleted", () => {
    expect(bulkSelectionMode([site(true)])).toBe("deleted");
  });

  it("is mixed when active and deleted sites are selected together", () => {
    expect(bulkSelectionMode([site(false), site(true)])).toBe("mixed");
  });
});

describe("bulkRestoreMessage", () => {
  it("counts restored sites", () => {
    expect(bulkRestoreMessage(2, 0)).toBe("2 sites restored");
  });

  it("uses the singular for one site", () => {
    expect(bulkRestoreMessage(1, 0)).toBe("1 site restored");
  });

  it("reports sites that could not be restored", () => {
    expect(bulkRestoreMessage(0, 2)).toBe("2 sites could not be restored");
  });

  it("reports both counts when some succeed and some are blocked", () => {
    expect(bulkRestoreMessage(1, 1)).toBe(
      "1 site restored, 1 could not be restored",
    );
  });
});

describe("canDeleteSite", () => {
  it("allows deleting a site with no locations, positions, and users", () => {
    expect(
      canDeleteSite({ activeLocations: 0, activePositions: 0, activeShifts: 0, assignedUsers: 0 }),
    ).toEqual({
      ok: true,
    });
  });

  it("blocks deleting a site with one active location", () => {
    const result = canDeleteSite({
      activeLocations: 1,
      activePositions: 0,
      activeShifts: 0,
      assignedUsers: 0,
    });

    expect(result.ok).toBe(false);
    expect(result).toHaveProperty("formError");
    expect((result as { formError: string }).formError).toContain(
      "1 active location",
    );
  });

  it("names both counts when the site has locations and users", () => {
    expect(
      canDeleteSite({ activeLocations: 2, activePositions: 0, activeShifts: 0, assignedUsers: 1 }),
    ).toEqual({
      ok: false,
      formError:
        "This site has 2 active locations and 1 HO user assigned. Move or delete them first.",
    });
  });

  it("blocks deleting a site that still has HO users assigned", () => {
    const result = canDeleteSite({
      activeLocations: 0,
      activePositions: 0,
      activeShifts: 0,
      assignedUsers: 3,
    });

    expect(result.ok).toBe(false);
    expect((result as { formError: string }).formError).toContain(
      "3 HO users assigned",
    );
  });

  it("blocks deleting a site with one active position", () => {
    expect(
      canDeleteSite({ activeLocations: 0, activePositions: 1, activeShifts: 0, assignedUsers: 0 }),
    ).toEqual({
      ok: false,
      formError:
        "This site has 1 active position. Move or delete them first.",
    });
  });

  it("names all three counts when the site has locations, positions, and users", () => {
    expect(
      canDeleteSite({ activeLocations: 2, activePositions: 3, activeShifts: 0, assignedUsers: 1 }),
    ).toEqual({
      ok: false,
      formError:
        "This site has 2 active locations, 3 active positions and 1 HO user assigned. Move or delete them first.",
    });
  });

  it("blocks deleting a site with one active shift", () => {
    expect(
      canDeleteSite({ activeLocations: 0, activePositions: 0, activeShifts: 1, assignedUsers: 0 }),
    ).toEqual({
      ok: false,
      formError: "This site has 1 active shift. Move or delete them first.",
    });
  });

  it("counts several active shifts", () => {
    const result = canDeleteSite({
      activeLocations: 0,
      activePositions: 0,
      activeShifts: 3,
      assignedUsers: 0,
    });

    expect((result as { formError: string }).formError).toContain("3 active shifts");
  });

  it("names every count in order when the site has locations, positions, shifts, and users", () => {
    expect(
      canDeleteSite({ activeLocations: 2, activePositions: 3, activeShifts: 1, assignedUsers: 1 }),
    ).toEqual({
      ok: false,
      formError:
        "This site has 2 active locations, 3 active positions, 1 active shift and 1 HO user assigned. Move or delete them first.",
    });
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
