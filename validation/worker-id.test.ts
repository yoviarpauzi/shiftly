import { describe, expect, it } from "vitest";
import { parseWorkerId } from "./worker-id";

const WORKER_ID = "11111111-1111-4111-8111-111111111111";

describe("parseWorkerId", () => {
  it("returns a valid uuid unchanged", () => {
    expect(parseWorkerId(WORKER_ID)).toBe(WORKER_ID);
  });

  it("returns null for a value that is not a uuid", () => {
    expect(parseWorkerId("abc")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseWorkerId("")).toBeNull();
  });
});
