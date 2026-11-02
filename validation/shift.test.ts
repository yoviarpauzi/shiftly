import { describe, expect, it } from "vitest";
import { shiftSchema, shiftUpdateSchema } from "./shift";

const SITE_ID = "11111111-1111-4111-8111-111111111111";

const base = {
  order: 1,
  name: "Morning",
  startTime: "06:00",
  endTime: "14:00",
  siteId: SITE_ID,
};

const issues = (input: Record<string, unknown>) => {
  const result = shiftSchema.safeParse({ ...base, ...input });
  return result.success
    ? []
    : result.error.issues.map((issue) => ({ path: issue.path, message: issue.message }));
};

describe("shiftSchema", () => {
  it("accepts a valid shift", () => {
    expect(shiftSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a shift that crosses midnight", () => {
    expect(issues({ startTime: "22:00", endTime: "06:00" })).toEqual([]);
  });

  it("rejects an end time equal to the start time on the end time field", () => {
    expect(issues({ startTime: "06:00", endTime: "06:00" })).toEqual([
      { path: ["endTime"], message: "End time must differ from start time" },
    ]);
  });

  it.each([0, 10, 1.5, Number.NaN, "2"])("rejects the order %s", (order) => {
    expect(issues({ order }).map((issue) => issue.path)).toEqual([["order"]]);
  });

  it.each([1, 9])("accepts the order %s", (order) => {
    expect(issues({ order })).toEqual([]);
  });

  it("trims surrounding spaces from the name", () => {
    expect(shiftSchema.parse({ ...base, name: "  Morning  " }).name).toBe("Morning");
  });

  it("rejects an empty name and a name made only of spaces", () => {
    expect(issues({ name: "" })).toEqual([
      { path: ["name"], message: "Shift name is required" },
    ]);
    expect(issues({ name: "   " })).toEqual([
      { path: ["name"], message: "Shift name is required" },
    ]);
  });

  it("accepts 100 characters and rejects 101", () => {
    expect(issues({ name: "a".repeat(100) })).toEqual([]);
    expect(issues({ name: "a".repeat(101) })).toEqual([
      { path: ["name"], message: "Shift name must be 100 characters or fewer" },
    ]);
  });

  it.each(["24:00", "6:00", "06:60", "06:00:00", ""])("rejects the start time %j", (startTime) => {
    expect(issues({ startTime }).map((issue) => issue.path)).toContainEqual(["startTime"]);
  });

  it.each(["24:00", "6:00", "06:60", "06:00:00", ""])("rejects the end time %j", (endTime) => {
    expect(issues({ endTime }).map((issue) => issue.path)).toContainEqual(["endTime"]);
  });

  it("rejects a site id that is not a uuid", () => {
    expect(issues({ siteId: "x" })).toEqual([{ path: ["siteId"], message: "Choose a site" }]);
  });
});

describe("shiftUpdateSchema", () => {
  it("accepts input without a site id", () => {
    const update = { order: 1, name: "Morning", startTime: "06:00", endTime: "14:00" };

    expect(shiftUpdateSchema.safeParse(update).success).toBe(true);
  });

  it("rejects an end time equal to the start time", () => {
    const result = shiftUpdateSchema.safeParse({
      order: 1,
      name: "Morning",
      startTime: "06:00",
      endTime: "06:00",
    });

    expect(result.success).toBe(false);
  });
});
