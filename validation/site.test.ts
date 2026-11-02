import { describe, expect, it } from "vitest";
import { siteSchema } from "./site";

const valid = { name: "Nestle", code: "AB" };

const messages = (input: { name?: string; code?: string }) => {
  const result = siteSchema.safeParse({ ...valid, ...input });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("siteSchema", () => {
  it("rejects an empty name", () => {
    expect(messages({ name: "" })).toEqual(["Site name is required"]);
  });

  it("rejects a name made only of spaces", () => {
    expect(messages({ name: "   " })).toEqual(["Site name is required"]);
  });

  it("trims surrounding spaces", () => {
    expect(siteSchema.parse({ ...valid, name: "  Nestle  " }).name).toBe("Nestle");
  });

  it("accepts exactly 100 characters", () => {
    expect(messages({ name: "a".repeat(100) })).toEqual([]);
  });

  it("rejects 101 characters", () => {
    expect(messages({ name: "a".repeat(101) })).toEqual([
      "Site name must be 100 characters or fewer",
    ]);
  });

  describe("code", () => {
    const CODE_MESSAGE = "Code must be 2 to 6 letters or digits";
    const codeMessages = (code: string | undefined) => messages({ code });

    it("trims and uppercases", () => {
      expect(siteSchema.parse({ ...valid, code: "  abc " }).code).toBe(
        "ABC",
      );
    });

    it("accepts 2 and 6 characters, letters and digits", () => {
      expect(codeMessages("AB")).toEqual([]);
      expect(codeMessages("a1b2c3")).toEqual([]);
    });

    it.each(["A", "ABCDEFG", "AB-1", ""])("rejects %j", (code) => {
      expect(codeMessages(code)).toEqual([CODE_MESSAGE]);
    });

    it("rejects a missing code", () => {
      expect(codeMessages(undefined)).toEqual([CODE_MESSAGE]);
    });
  });
});
