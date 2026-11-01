import { describe, expect, it } from "vitest";
import { parseDepartmentId } from "./department-id";

const DEPARTMENT_ID = "11111111-1111-4111-8111-111111111111";

describe("parseDepartmentId", () => {
  it("returns a valid uuid unchanged", () => {
    expect(parseDepartmentId(DEPARTMENT_ID)).toBe(DEPARTMENT_ID);
  });

  it("returns null for a value that is not a uuid", () => {
    expect(parseDepartmentId("abc")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseDepartmentId("")).toBeNull();
  });

  it("returns null for a uuid with the wrong shape", () => {
    expect(parseDepartmentId("11111111-1111-4111-8111-11111111111")).toBeNull();
  });
});
