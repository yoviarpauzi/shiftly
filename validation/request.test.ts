import { describe, expect, it } from "vitest";
import { createRequestSchema, rejectReasonSchema, updateRequestSchema } from "./request";

const MIN_DATE = "2026-11-02";
const LOCATION_ID = "11111111-1111-4111-8111-111111111111";
const DEPARTMENT_ID = "22222222-2222-4222-8222-222222222222";
const SUB_DEPARTMENT_ID = "33333333-3333-4333-8333-333333333333";
const POSITION_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_POSITION_ID = "55555555-5555-4555-8555-555555555555";

const line = {
  departmentId: DEPARTMENT_ID,
  subDepartmentId: null,
  positionId: POSITION_ID,
  headcount: 3,
};

const base = {
  type: "daily",
  startDate: "2026-11-02",
  locationId: LOCATION_ID,
  note: "Extra hands for the dock",
  lines: [line],
};

const manyLines = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    ...line,
    // Each line gets its own sub-department so none is a duplicate.
    subDepartmentId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  }));

const issues = (input: Record<string, unknown>, minDate: string | null = MIN_DATE) => {
  const result = createRequestSchema(minDate).safeParse({ ...base, ...input });
  return result.success
    ? []
    : result.error.issues.map((issue) => ({ path: issue.path, message: issue.message }));
};

const paths = (input: Record<string, unknown>, minDate: string | null = MIN_DATE) =>
  issues(input, minDate).map((issue) => issue.path);

describe("createRequestSchema", () => {
  it("accepts a valid daily request", () => {
    expect(createRequestSchema(MIN_DATE).safeParse(base).success).toBe(true);
  });

  it("accepts a valid weekly request", () => {
    expect(issues({ type: "weekly" })).toEqual([]);
  });

  it("rejects a type that is not daily or weekly", () => {
    expect(paths({ type: "monthly" })).toEqual([["type"]]);
  });

  it("rejects a missing location", () => {
    expect(paths({ locationId: "" })).toEqual([["locationId"]]);
  });

  it("rejects a date before the minimum on the startDate field", () => {
    expect(paths({ startDate: "2026-11-01" })).toEqual([["startDate"]]);
  });

  it("accepts a date equal to the minimum and one after it", () => {
    expect(issues({ startDate: "2026-11-02" })).toEqual([]);
    expect(issues({ startDate: "2026-11-03" })).toEqual([]);
  });

  it.each(["2026-02-30", "11/02/2026", "2026-13-01", "2026-1-5", "", "tomorrow"])(
    "rejects the date %s",
    (startDate) => {
      expect(paths({ startDate })).toEqual([["startDate"]]);
    },
  );

  it("accepts a real leap day", () => {
    expect(issues({ startDate: "2028-02-29" })).toEqual([]);
  });

  it("accepts a past date when there is no minimum", () => {
    expect(issues({ startDate: "2020-01-01" }, null)).toEqual([]);
  });

  it("still rejects a malformed date when there is no minimum", () => {
    expect(paths({ startDate: "2026-02-30" }, null)).toEqual([["startDate"]]);
  });

  it("rejects an empty line list", () => {
    expect(paths({ lines: [] })).toEqual([["lines"]]);
  });

  it("accepts 50 lines and rejects 51", () => {
    expect(issues({ lines: manyLines(50) })).toEqual([]);
    expect(paths({ lines: manyLines(51) })).toEqual([["lines"]]);
  });

  it.each([0, 1000, 1.5, "2"])("rejects the headcount %s", (headcount) => {
    expect(paths({ lines: [{ ...line, headcount }] })).toEqual([["lines", 0, "headcount"]]);
  });

  it.each([1, 999])("accepts the headcount %s", (headcount) => {
    expect(issues({ lines: [{ ...line, headcount }] })).toEqual([]);
  });

  it("rejects two lines with the same department, sub-department, and position", () => {
    expect(paths({ lines: [line, { ...line, headcount: 5 }] })).toEqual([["lines"]]);
  });

  it("rejects a duplicate that has the same set sub-department", () => {
    const withSub = { ...line, subDepartmentId: SUB_DEPARTMENT_ID };
    expect(paths({ lines: [withSub, { ...withSub }] })).toEqual([["lines"]]);
  });

  it("accepts the same department and sub-department with a different position", () => {
    expect(issues({ lines: [line, { ...line, positionId: OTHER_POSITION_ID }] })).toEqual([]);
  });

  it("treats a null and a set sub-department as different lines", () => {
    expect(
      issues({ lines: [line, { ...line, subDepartmentId: SUB_DEPARTMENT_ID }] }),
    ).toEqual([]);
  });

  it("accepts a note of 500 characters and rejects 501", () => {
    expect(issues({ note: "a".repeat(500) })).toEqual([]);
    expect(paths({ note: "a".repeat(501) })).toEqual([["note"]]);
  });

  it("turns a blank note into null", () => {
    const result = createRequestSchema(MIN_DATE).safeParse({ ...base, note: "  " });
    expect(result.success && result.data.note).toBeNull();
  });

  it("trims a note", () => {
    const result = createRequestSchema(MIN_DATE).safeParse({ ...base, note: "  dock  " });
    expect(result.success && result.data.note).toBe("dock");
  });

  it("turns a missing note into null", () => {
    const { note: _note, ...rest } = base;
    void _note;
    const result = createRequestSchema(MIN_DATE).safeParse(rest);
    expect(result.success && result.data.note).toBeNull();
  });
});

describe("updateRequestSchema", () => {
  const updateBase = { startDate: "2026-11-02", note: null, lines: [line] };

  it("accepts startDate, note, and lines without a type or location", () => {
    expect(updateRequestSchema(MIN_DATE).safeParse(updateBase).success).toBe(true);
  });

  it("applies the date rule", () => {
    const result = updateRequestSchema(MIN_DATE).safeParse({ ...updateBase, startDate: "2026-11-01" });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues.map((issue) => issue.path)).toEqual([
      ["startDate"],
    ]);
  });

  it("skips the date rule when there is no minimum", () => {
    expect(
      updateRequestSchema(null).safeParse({ ...updateBase, startDate: "2020-01-01" }).success,
    ).toBe(true);
  });

  it("rejects duplicate lines", () => {
    const result = updateRequestSchema(MIN_DATE).safeParse({
      ...updateBase,
      lines: [line, { ...line }],
    });
    expect(!result.success && result.error.issues.map((issue) => issue.path)).toEqual([["lines"]]);
  });
});

describe("rejectReasonSchema", () => {
  it("trims the reason", () => {
    expect(rejectReasonSchema.parse("  no headcount  ")).toBe("no headcount");
  });

  it("rejects an empty or blank reason", () => {
    expect(rejectReasonSchema.safeParse("").success).toBe(false);
    expect(rejectReasonSchema.safeParse("   ").success).toBe(false);
  });

  it("allows 500 characters and rejects 501", () => {
    expect(rejectReasonSchema.safeParse("a".repeat(500)).success).toBe(true);
    expect(rejectReasonSchema.safeParse("a".repeat(501)).success).toBe(false);
  });
});
