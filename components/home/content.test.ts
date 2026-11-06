import { describe, expect, it } from "vitest";
import type { RecordingSize, StepCrop } from "@/types/home";
import * as content from "@/components/home/content";
import {
  BAND_COPY,
  BAND_COPY_SIGNED_IN,
  DASHBOARD_PHONE_CROP,
  DASHBOARD_RECORDING,
  FOOTER_COPY,
  HERO_COPY,
  HERO_WORDS,
  NAV_LINKS,
  RECORDING_SIZE,
  ROLES,
  RULES,
  SCOPE_SITES,
  STEPS,
  STEP_CROP,
} from "@/components/home/content";

function collectStrings(value: unknown, found: string[] = []): string[] {
  if (typeof value === "string") {
    found.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, found);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, found);
  }
  return found;
}

// The page area of a recording starts right of the sidebar and below the top bar.
const PAGE_LEFT = 288;
const PAGE_TOP = 56;

function expectInsidePageArea(crop: StepCrop, size: RecordingSize) {
  expect(crop.x).toBeGreaterThanOrEqual(PAGE_LEFT);
  expect(crop.y).toBeGreaterThanOrEqual(PAGE_TOP);
  expect(crop.x + crop.width).toBeLessThanOrEqual(size.width);
  expect(crop.y + crop.height).toBeLessThanOrEqual(size.height);
}

describe("landing copy", () => {
  it("puts the headline's lead before the rotating rule", () => {
    expect(HERO_COPY.lead).toBe("Rosters that respect");
  });

  it("rotates through four rules the engine enforces, in phrases that read after \"respect\"", () => {
    expect(HERO_WORDS).toEqual([
      "working days",
      "shift limits",
      "position rules",
      "monthly caps",
    ]);
    // The pill is as wide as the longest phrase and must fit a 320 px phone at 40 px type.
    for (const word of HERO_WORDS) expect(word.length).toBeLessThanOrEqual(14);
  });

  it("says who the page is for and the problem, using only what the PRD states", () => {
    expect(HERO_COPY.audience).toBe(
      "For outsourcing teams that build shift rosters for several client sites by hand.",
    );
  });

  it("gives every step a phone crop that stays inside the recording", () => {
    for (const step of STEPS) {
      expectInsidePageArea(step.phoneCrop, RECORDING_SIZE);
      // Narrower than the desktop crop, so the text is larger on a phone.
      expect(step.phoneCrop.width).toBeLessThan(STEP_CROP.width);
    }
  });

  it("keeps the phone crop of the hero window inside the dashboard recording", () => {
    expectInsidePageArea(DASHBOARD_PHONE_CROP, DASHBOARD_RECORDING);
  });

  it("states the deterministic claim without promising more than is built", () => {
    expect(HERO_COPY.claims).toEqual([
      "Same request, same roster.",
      "No AI model is involved.",
    ]);
    for (const text of [
      HERO_COPY.subtitle,
      ...HERO_COPY.claims,
      ...HERO_WORDS,
    ]) {
      expect(text.toLowerCase()).not.toMatch(/break|annual off/);
    }
  });

  it("keeps the crop of the recordings inside the recording and in the page area", () => {
    expectInsidePageArea(STEP_CROP, RECORDING_SIZE);
  });

  it("describes the approver by the site assignment, not by an expansion of HO", () => {
    expect(STEPS[1]?.detail).toBe(
      "A weekly request waits for the HO assigned to the site, the role that sees all of its locations, or a superadmin. A daily request is approved when it is saved.",
    );
  });

  it("has the five steps in order", () => {
    expect(STEPS.map((step) => step.title)).toEqual([
      "Request",
      "Approve",
      "Generate",
      "Confirm",
      "Mark attendance",
    ]);
  });

  it("gives every step a detail, its own video, and its own poster", () => {
    const slugs = ["request", "approve", "generate", "confirm", "attendance"];

    STEPS.forEach((step, index) => {
      expect(step.detail.length).toBeGreaterThan(20);
      expect(step.alt.length).toBeGreaterThan(20);
      expect(step.video).toBe(`/landing/steps/${slugs[index]}.mp4`);
      expect(step.poster).toBe(`/landing/steps/${slugs[index]}.webp`);
    });
    expect(new Set(STEPS.map((step) => step.detail)).size).toBe(STEPS.length);
    expect(new Set(STEPS.map((step) => step.alt)).size).toBe(STEPS.length);
  });

  it("keeps the generate step's detail about the work rules and a repeatable roster", () => {
    expect(STEPS[2]?.detail).toBe(
      "Shiftly builds the roster from your work rules. The same request always gives the same roster.",
    );
  });

  it("has the four rules the roster engine enforces, in order", () => {
    expect(RULES.map((rule) => rule.title)).toEqual([
      "Working days per week",
      "Max working days per month",
      "Shift change",
      "Position match",
    ]);
  });

  it("describes shift change and position match as the engine applies them", () => {
    const detail = (title: string) =>
      RULES.find((rule) => rule.title === title)?.detail;
    expect(detail("Shift change")).toBe(
      "A worker can move back to a lower shift only after a set number of working days in a row.",
    );
    expect(detail("Position match")).toBe(
      "When required, only workers with the request line's position are assigned.",
    );
  });

  it("has three roles, outermost first", () => {
    expect(ROLES.map((role) => role.name)).toEqual([
      "Superadmin",
      "HO",
      "Admin site",
    ]);
  });

  it("draws each role's reach over every location of the example", () => {
    for (const role of ROLES) {
      expect(role.reach.map((cells) => cells.length)).toEqual(
        SCOPE_SITES.map((site) => site.locations),
      );
    }

    const [superadmin, ho, adminSite] = ROLES;
    // Superadmin sees all sites.
    expect(superadmin?.reach.flat().every(Boolean)).toBe(true);
    // HO sees every location of one site and nothing of the others.
    const hoSites = ho?.reach ?? [];
    expect(hoSites.filter((cells) => cells.every(Boolean))).toHaveLength(1);
    expect(hoSites.filter((cells) => cells.some(Boolean) && !cells.every(Boolean))).toHaveLength(0);
    // Admin site sees exactly one location.
    expect(adminSite?.reach.flat().filter(Boolean)).toHaveLength(1);
  });

  it("tells visitors where accounts come from", () => {
    expect(BAND_COPY.title).toBe("Accounts come from your superadmin.");
    expect(BAND_COPY.detail).toBe(
      "No account yet? Your superadmin adds people in the Users menu.",
    );
  });

  it("greets a signed-in visitor instead of asking if they have an account", () => {
    expect(BAND_COPY_SIGNED_IN.title).toBe("Your rosters are waiting.");
    expect(BAND_COPY_SIGNED_IN.detail).not.toMatch(/no account/i);
  });

  it("links the nav to the section anchors, in page order", () => {
    expect(NAV_LINKS.map((link) => link.href)).toEqual([
      "#rules",
      "#how-it-works",
      "#roles",
    ]);
  });

  it("writes the footer year as a literal", () => {
    expect(FOOTER_COPY.copyright).toBe("© 2026 Shiftly");
  });

  it("contains no em dash and no double hyphen in any string", () => {
    const strings = collectStrings(content);
    expect(strings.length).toBeGreaterThan(40);
    for (const text of strings) {
      expect(text).not.toContain("—");
      expect(text).not.toContain(" -- ");
    }
  });
});
