import { describe, expect, it } from "vitest";
import { isAllowedRole } from "./roles";

describe("isAllowedRole", () => {
  it.each(["superadmin", "ho", "admin_site"])("accepts %s", (role) => {
    expect(isAllowedRole(role)).toBe(true);
  });

  it.each([null, undefined, "", "user", "admin", "Superadmin"])(
    "rejects %j",
    (role) => {
      expect(isAllowedRole(role)).toBe(false);
    },
  );
});
