import { describe, expect, it } from "vitest";
import { LOCATION_TIMEZONES } from "@/validation/location";
import { dateInZone } from "./indonesia-date";

describe("dateInZone", () => {
  it("rolls over to the next day at 17:00 UTC in Jakarta", () => {
    expect(dateInZone("Asia/Jakarta", new Date("2026-11-30T17:30:00Z"))).toBe("2026-12-01");
  });

  it("stays on the same day just before the Jakarta rollover", () => {
    expect(dateInZone("Asia/Jakarta", new Date("2026-11-30T16:59:00Z"))).toBe("2026-11-30");
  });

  it("is already the next day in Makassar and Jayapura when Jakarta is not", () => {
    const now = new Date("2026-10-31T16:30:00Z");

    expect(dateInZone("Asia/Jakarta", now)).toBe("2026-10-31");
    expect(dateInZone("Asia/Makassar", now)).toBe("2026-11-01");
    expect(dateInZone("Asia/Jayapura", now)).toBe("2026-11-01");
  });

  it("is the next day in all three zones at 17:30 UTC", () => {
    const now = new Date("2026-10-31T17:30:00Z");

    for (const zone of LOCATION_TIMEZONES) {
      expect(dateInZone(zone, now)).toBe("2026-11-01");
    }
  });

  it("defaults to the current time", () => {
    expect(dateInZone("Asia/Jakarta")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("throws a clear error for a zone that is not allowed", () => {
    expect(() => dateInZone("Asia/Singapore" as never)).toThrow("Unsupported time zone");
  });

  // Jakarta is the westernmost zone. The early check in createRequest relies on its date never
  // being ahead of another zone's, so a zone added west of Jakarta must fail here.
  it("never has a Jakarta date later than another allowed zone's date", () => {
    const start = Date.parse("2026-11-01T00:00:00Z");

    for (let minutes = 0; minutes <= 24 * 60; minutes += 30) {
      const now = new Date(start + minutes * 60_000);

      for (const zone of LOCATION_TIMEZONES) {
        expect(dateInZone("Asia/Jakarta", now) <= dateInZone(zone, now)).toBe(true);
      }
    }
  });
});
