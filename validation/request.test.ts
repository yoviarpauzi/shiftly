import { describe, expect, it } from "vitest";
import { createRequestSchema, rejectReasonSchema, updateRequestSchema } from "./request";

const MIN_DATE = "2026-11-02";
const LOCATION_ID = "11111111-1111-4111-8111-111111111111";
const DEPARTMENT_ID = "22222222-2222-4222-8222-222222222222";
const SUB_DEPARTMENT_ID = "33333333-3333-4333-8333-333333333333";
const POSITION_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_POSITION_ID = "55555555-5555-4555-8555-555555555555";
const SHIFT_ID = "66666666-6666-4666-8666-666666666666";
const OTHER_SHIFT_ID = "77777777-7777-4777-8777-777777777777";
const DUPLICATE_MESSAGE =
  "Two lines have the same department, sub-department, position, and shift";

const line = {
  departmentId: DEPARTMENT_ID,
  subDepartmentId: null,
  positionId: POSITION_ID,
  shiftId: null,
  headcounts: [3],
};

const WEEK = [0, 3, 3, 0, 5, 5, 5];

const base = {
  type: "daily",
  startDate: "2026-11-02",
  locationId: LOCATION_ID,
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
    expect(issues({ type: "weekly", lines: [{ ...line, headcounts: WEEK }] })).toEqual([]);
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

  it.each([[[1]], [WEEK]])("accepts the headcounts %j", (headcounts) => {
    expect(issues({ lines: [{ ...line, headcounts }] })).toEqual([]);
  });

  it.each([[[]], [[1, 2]], [[1, 2, 3, 4, 5, 6, 7, 8]]])(
    "rejects the headcounts %j as the wrong length",
    (headcounts) => {
      expect(issues({ lines: [{ ...line, headcounts }] })).toEqual([
        {
          path: ["lines", 0, "headcounts"],
          message: "Headcount does not match the request type",
        },
      ]);
    },
  );

  it.each([0, 999])("accepts the headcount %s at shape level", (headcount) => {
    expect(issues({ lines: [{ ...line, headcounts: [headcount] }] })).toEqual([]);
  });

  it.each([
    [-1, "Headcount must be between 0 and 999"],
    [1000, "Headcount must be between 0 and 999"],
    [1.5, "Headcount must be a whole number"],
    [Number.NaN, "Headcount is required"],
    ["2", "Headcount is required"],
  ])("rejects the headcount %s", (headcount, message) => {
    expect(issues({ lines: [{ ...line, headcounts: [headcount] }] })).toEqual([
      { path: ["lines", 0, "headcounts", 0], message },
    ]);
  });

  it("rejects a bad number on any day of a weekly line", () => {
    const headcounts = [...WEEK];
    headcounts[4] = 1000;

    expect(paths({ type: "weekly", lines: [{ ...line, headcounts }] })).toEqual([
      ["lines", 0, "headcounts", 4],
    ]);
  });

  it("rejects missing headcounts", () => {
    const withoutHeadcounts = {
      departmentId: DEPARTMENT_ID,
      subDepartmentId: null,
      positionId: POSITION_ID,
      shiftId: null,
    };

    expect(issues({ lines: [withoutHeadcounts] })).toEqual([
      { path: ["lines", 0, "headcounts"], message: "Headcount is required" },
    ]);
  });

  it("drops the old single headcount key", () => {
    const result = createRequestSchema(MIN_DATE).safeParse({
      ...base,
      lines: [{ ...line, headcount: 3 }],
    });

    expect(result.success).toBe(true);
    expect(result.success && "headcount" in result.data.lines[0]).toBe(false);
  });

  it("rejects two lines with the same department, sub-department, and position", () => {
    expect(paths({ lines: [line, { ...line, headcounts: [5] }] })).toEqual([["lines"]]);
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

  it("accepts a line with shiftId null", () => {
    expect(issues({ lines: [{ ...line, shiftId: null }] })).toEqual([]);
  });

  it("accepts a line with a shift uuid", () => {
    expect(issues({ lines: [{ ...line, shiftId: SHIFT_ID }] })).toEqual([]);
  });

  it("rejects a shiftId that is not a uuid on the shiftId field", () => {
    expect(issues({ lines: [{ ...line, shiftId: "shift-1" }] })).toEqual([
      { path: ["lines", 0, "shiftId"], message: "Choose a shift" },
    ]);
  });

  it("rejects a line with no shiftId key", () => {
    const withoutShift = {
      departmentId: DEPARTMENT_ID,
      subDepartmentId: null,
      positionId: POSITION_ID,
      headcounts: [3],
    };

    expect(paths({ lines: [withoutShift] })).toEqual([["lines", 0, "shiftId"]]);
  });

  it("accepts two lines with the same department, sub-department, and position when their shifts differ", () => {
    expect(
      issues({
        lines: [
          { ...line, shiftId: null },
          { ...line, shiftId: SHIFT_ID },
          { ...line, shiftId: OTHER_SHIFT_ID },
        ],
      }),
    ).toEqual([]);
  });

  it("rejects two lines with the same department, sub-department, position, and shift", () => {
    expect(
      issues({
        lines: [
          { ...line, shiftId: SHIFT_ID },
          { ...line, shiftId: SHIFT_ID, headcounts: [5] },
        ],
      }),
    ).toEqual([{ path: ["lines"], message: DUPLICATE_MESSAGE }]);
  });

  it("rejects two Any shift lines for the same position with the same message", () => {
    expect(issues({ lines: [line, { ...line }] })).toEqual([
      { path: ["lines"], message: DUPLICATE_MESSAGE },
    ]);
  });

  it("drops a note key from the output", () => {
    const result = createRequestSchema(MIN_DATE).safeParse({ ...base, note: "Extra hands" });

    expect(result.success).toBe(true);
    expect(result.success && "note" in result.data).toBe(false);
  });
});

describe("updateRequestSchema", () => {
  const updateBase = { startDate: "2026-11-02", lines: [line] };

  it("accepts startDate and lines without a type or location", () => {
    expect(updateRequestSchema(MIN_DATE).safeParse(updateBase).success).toBe(true);
  });

  it("drops a note key from the output", () => {
    const result = updateRequestSchema(MIN_DATE).safeParse({ ...updateBase, note: "Extra hands" });

    expect(result.success).toBe(true);
    expect(result.success && "note" in result.data).toBe(false);
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
