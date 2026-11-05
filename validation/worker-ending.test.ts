import { describe, expect, it } from "vitest";
import { parseWorkerEnding } from "./worker-ending";

describe("parseWorkerEnding", () => {
  it("is true only for 1", () => {
    expect(parseWorkerEnding("1")).toBe(true);
  });

  it("is false when the value is missing or anything else", () => {
    expect(parseWorkerEnding(undefined)).toBe(false);
    expect(parseWorkerEnding("")).toBe(false);
    expect(parseWorkerEnding("0")).toBe(false);
    expect(parseWorkerEnding("true")).toBe(false);
  });

  it("reads the first value of a repeated param", () => {
    expect(parseWorkerEnding(["1", "0"])).toBe(true);
    expect(parseWorkerEnding(["0", "1"])).toBe(false);
  });
});
