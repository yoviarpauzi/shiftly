import { describe, expect, it } from "vitest";
import { parseUserRole } from "./user-role";

describe("parseUserRole", () => {
  it("defaults to all when the parameter is missing", () => {
    expect(parseUserRole(undefined)).toBe("all");
  });

  it("reads each supported role", () => {
    expect(parseUserRole("superadmin")).toBe("superadmin");
    expect(parseUserRole("ho")).toBe("ho");
    expect(parseUserRole("admin_site")).toBe("admin_site");
  });

  it("falls back to all for an unknown value", () => {
    expect(parseUserRole("owner")).toBe("all");
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseUserRole(["ho", "superadmin"])).toBe("ho");
  });
});
