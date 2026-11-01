import { describe, expect, it } from "vitest";
import type { LocationRow } from "@/types/locations";
import {
  bulkDeleteMessage,
  bulkRestoreMessage,
  bulkSelectionMode,
  canDeleteLocation,
  nameFieldError,
} from "./location-rules";

const location = (deleted: boolean): LocationRow => ({
  id: crypto.randomUUID(),
  name: "Kejayan",
  siteId: crypto.randomUUID(),
  siteName: "Nestle",
  deletedAt: deleted ? new Date() : null,
});

describe("canDeleteLocation", () => {
  it("allows deleting a location with no admin site users and no active departments", () => {
    expect(canDeleteLocation({ assignedAdminSites: 0, activeDepartments: 0 })).toEqual({ ok: true });
  });

  it("blocks deleting a location with one admin site user", () => {
    expect(canDeleteLocation({ assignedAdminSites: 1, activeDepartments: 0 })).toEqual({
      ok: false,
      formError: "This location has 1 admin site user assigned. Move them first.",
    });
  });

  it("uses the plural when several admin site users are assigned", () => {
    expect(canDeleteLocation({ assignedAdminSites: 2, activeDepartments: 0 })).toEqual({
      ok: false,
      formError: "This location has 2 admin site users assigned. Move them first.",
    });
  });

  it("blocks deleting a location with one active department", () => {
    expect(canDeleteLocation({ assignedAdminSites: 0, activeDepartments: 1 })).toEqual({
      ok: false,
      formError: "This location has 1 active department. Delete it first.",
    });
  });

  it("uses the plural when several departments are active", () => {
    expect(canDeleteLocation({ assignedAdminSites: 0, activeDepartments: 2 })).toEqual({
      ok: false,
      formError: "This location has 2 active departments. Delete them first.",
    });
  });

  it("names both blockers when admin site users and departments are present", () => {
    expect(canDeleteLocation({ assignedAdminSites: 1, activeDepartments: 2 })).toEqual({
      ok: false,
      formError:
        "This location has 1 admin site user assigned and 2 active departments. Move the users and delete the departments first.",
    });
  });
});

describe("nameFieldError", () => {
  it("wraps a message so the form can show it", () => {
    expect(nameFieldError("Location name is required")).toEqual({
      message: "Location name is required",
    });
  });

  it("returns undefined when there is no message", () => {
    expect(nameFieldError(undefined)).toBeUndefined();
  });
});

describe("bulkSelectionMode", () => {
  it("is none when nothing is selected", () => {
    expect(bulkSelectionMode([])).toBe("none");
  });

  it("is active when every selected location is active", () => {
    expect(bulkSelectionMode([location(false), location(false)])).toBe("active");
  });

  it("is deleted when every selected location is deleted", () => {
    expect(bulkSelectionMode([location(true)])).toBe("deleted");
  });

  it("is mixed when active and deleted locations are selected together", () => {
    expect(bulkSelectionMode([location(false), location(true)])).toBe("mixed");
  });
});

describe("bulkDeleteMessage", () => {
  it("counts deleted locations", () => {
    expect(bulkDeleteMessage(2, 0)).toBe("2 locations deleted");
  });

  it("uses the singular for one location", () => {
    expect(bulkDeleteMessage(1, 0)).toBe("1 location deleted");
  });

  it("reports locations that could not be deleted", () => {
    expect(bulkDeleteMessage(0, 2)).toBe("2 locations could not be deleted");
  });

  it("reports both counts when some succeed and some are blocked", () => {
    expect(bulkDeleteMessage(1, 1)).toBe(
      "1 location deleted, 1 could not be deleted",
    );
  });
});

describe("bulkRestoreMessage", () => {
  it("counts restored locations", () => {
    expect(bulkRestoreMessage(2, 0)).toBe("2 locations restored");
  });

  it("uses the singular for one location", () => {
    expect(bulkRestoreMessage(1, 0)).toBe("1 location restored");
  });

  it("reports locations that could not be restored", () => {
    expect(bulkRestoreMessage(0, 2)).toBe("2 locations could not be restored");
  });

  it("reports both counts when some succeed and some are blocked", () => {
    expect(bulkRestoreMessage(1, 1)).toBe(
      "1 location restored, 1 could not be restored",
    );
  });
});
