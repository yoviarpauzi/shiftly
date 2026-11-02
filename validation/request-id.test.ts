import { describe, expect, it } from "vitest";
import { parseRequestId } from "./request-id";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";

describe("parseRequestId", () => {
  it("returns a valid uuid unchanged", () => {
    expect(parseRequestId(REQUEST_ID)).toBe(REQUEST_ID);
  });

  it("returns null for a value that is not a uuid", () => {
    expect(parseRequestId("new")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseRequestId("")).toBeNull();
  });

  it("returns null for a uuid with the wrong shape", () => {
    expect(parseRequestId("11111111-1111-4111-8111-11111111111")).toBeNull();
  });
});
