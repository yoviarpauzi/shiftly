import { describe, expect, it } from "vitest";
import * as content from "@/components/home/content";
import {
  FOOTER_COPY,
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
  it("lists the four words of the strip", () => {
    expect(WORDS).toEqual(["Requests", "Rosters", "Attendance", "Work rules"]);
  });

  it("has five steps and only the third is active with a detail", () => {
    expect(STEPS.map((step) => step.title)).toEqual([
      "Request",
      "Approve",
      "Generate",
      "Confirm",
      "Mark attendance",
    ]);
    expect(STEPS.map((step) => step.active)).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
    STEPS.forEach((step, index) => {
      if (index === 2) expect(step.detail).toEqual(expect.any(String));
      else expect(step.detail).toBeNull();
    });
  });

  it("has six rules in order", () => {
    expect(RULES.map((rule) => rule.title)).toEqual([
      "Working days per week",
      "Max working days per month",
      "Break",
      "Annual off",
      "Shift change",
      "Position match",
    ]);
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
