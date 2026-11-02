import { describe, expect, it } from "vitest";
import { LOCATION_TIMEZONES } from "@/validation/location";
import { timezoneLabel, timezoneOptionLabel } from "./location-timezone";

describe("timezoneLabel", () => {
  it("names the three Indonesian zones", () => {
    expect(timezoneLabel("Asia/Jakarta")).toBe("WIB");
    expect(timezoneLabel("Asia/Makassar")).toBe("WITA");
    expect(timezoneLabel("Asia/Jayapura")).toBe("WIT");
  });
});

describe("timezoneOptionLabel", () => {
  it("adds the zone name to the label", () => {
    expect(timezoneOptionLabel("Asia/Jakarta")).toBe("WIB (Asia/Jakarta)");
  });
});

describe("every allowed zone", () => {
  it("has a label and an option label", () => {
    for (const zone of LOCATION_TIMEZONES) {
      expect(timezoneLabel(zone)).not.toBe("");
      expect(timezoneOptionLabel(zone)).not.toBe("");
    }
  });
});
