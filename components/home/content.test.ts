import { describe, expect, it } from "vitest";
import * as content from "@/components/home/content";
import {
  FOOTER_COPY,
  HERO_COPY,
  HERO_WORDS,
  NAV_LINKS,
  ROLES,
  RULES,
  STEPS,
  WORDS,
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

describe("landing copy", () => {
  it("splits the headline into two lines around the rotating word", () => {
    expect(HERO_COPY.lead).toBe("Rosters that");
    expect(HERO_COPY.tail).toBe("the rules.");
  });

  it("rotates through four verbs and starts on follow", () => {
    expect(HERO_WORDS.map((entry) => entry.word)).toEqual([
      "follow",
      "respect",
      "honor",
      "meet",
    ]);
  });

  it("gives each rotating word its own dot colour from a theme token", () => {
    const dots = HERO_WORDS.map((entry) => entry.dotClass);
    expect(new Set(dots).size).toBe(HERO_WORDS.length);
    for (const dot of dots) expect(dot).toMatch(/^bg-chart-[1-5]$/);
  });

  it("lists the four words of the strip", () => {
    expect(WORDS).toEqual(["Requests", "Rosters", "Attendance", "Work rules"]);
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
      "A worker can move back to a lower shift only after a set number of working days.",
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

  it("links the nav to the section anchors", () => {
    expect(NAV_LINKS.map((link) => link.href)).toEqual([
      "#how-it-works",
      "#rules",
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
