import { describe, expect, it } from "vitest";

import {
  ATTENDANCE_STATUS_VALUES,
  REASON_MAX_LENGTH,
  parseAttendanceFilters,
  saveAttendanceSchema,
} from "./attendance";

const ASSIGNMENT_A = "3f6c1c1e-8a53-4b7e-9d0a-5b1e2f7c9a10";
const ASSIGNMENT_B = "7b2d9f40-1c6e-4a8b-8e35-0d4c6a1f2b93";
const ID_1 = "a1c4e2f6-5d3b-4c7a-9e18-6f2b0d8c4a57";
const TODAY = "2026-11-09";

const entry = (overrides: Record<string, unknown> = {}) => ({
  assignmentId: ASSIGNMENT_A,
  status: "present",
  reason: null,
  ...overrides,
});

const save = (entries: unknown[], date: unknown = "2026-11-09") =>
  saveAttendanceSchema.safeParse({ date, entries });

function issues(result: ReturnType<typeof save>) {
  return result.success ? [] : result.error.issues.map((i) => ({ path: i.path, message: i.message }));
}

describe("saveAttendanceSchema", () => {
  it("accepts a valid save", () => {
    expect(save([entry()]).success).toBe(true);
  });

  it("has only Present and Absent as statuses", () => {
    expect([...ATTENDANCE_STATUS_VALUES]).toEqual(["present", "absent"]);
  });

  it("accepts each of the two statuses and null", () => {
    for (const status of [...ATTENDANCE_STATUS_VALUES, null]) {
      expect(save([entry({ status })]).success).toBe(true);
    }
  });

  it("refuses a status outside the two, including the old sick and leave", () => {
    for (const status of ["late", "sick", "leave"]) {
      expect(issues(save([entry({ status })]))).toEqual([
        { path: ["entries", 0, "status"], message: "Choose a status" },
      ]);
    }
  });

  it("refuses an assignment id that is not a uuid", () => {
    expect(issues(save([entry({ assignmentId: "nope" })]))).toEqual([
      { path: ["entries", 0, "assignmentId"], message: "Choose a worker" },
    ]);
  });

  it("accepts a reason of exactly the maximum length", () => {
    const result = save([entry({ reason: "a".repeat(REASON_MAX_LENGTH) })]);

    expect(result.success).toBe(true);
  });

  it("refuses a reason one character over the maximum", () => {
    expect(issues(save([entry({ reason: "a".repeat(REASON_MAX_LENGTH + 1) })]))).toEqual([
      { path: ["entries", 0, "reason"], message: "Reason must be 200 characters or fewer" },
    ]);
  });

  it("stores an empty or whitespace-only reason as null", () => {
    for (const reason of ["", "   "]) {
      const result = save([entry({ reason })]);

      expect(result.success && result.data.entries[0].reason).toBeNull();
    }
  });

  it("trims the reason", () => {
    const result = save([entry({ reason: "  Fever  " })]);

    expect(result.success && result.data.entries[0].reason).toBe("Fever");
  });

  it("counts the trimmed reason against the maximum", () => {
    const padded = ` ${"a".repeat(REASON_MAX_LENGTH)} `;

    expect(save([entry({ reason: padded })]).success).toBe(true);
  });

  it("refuses a reason without a status", () => {
    expect(issues(save([entry({ status: null, reason: "Fever" })]))).toEqual([
      { path: ["entries", 0, "reason"], message: "Choose a status before adding a reason" },
    ]);
  });

  it("accepts no status and no reason", () => {
    expect(save([entry({ status: null, reason: "  " })]).success).toBe(true);
  });

  it("refuses the same assignment twice, on the second entry", () => {
    expect(issues(save([entry(), entry({ status: "absent" })]))).toEqual([
      { path: ["entries", 1, "assignmentId"], message: "Each worker can appear only once" },
    ]);
  });

  it("accepts two different assignments", () => {
    expect(save([entry(), entry({ assignmentId: ASSIGNMENT_B })]).success).toBe(true);
  });

  it("refuses an empty list", () => {
    expect(issues(save([]))).toEqual([{ path: ["entries"], message: "Nothing to save" }]);
  });

  it("refuses more than 500 entries", () => {
    const many = Array.from({ length: 501 }, (_, index) =>
      entry({ assignmentId: `3f6c1c1e-8a53-4b7e-9d0a-${String(index).padStart(12, "0")}` }),
    );

    expect(issues(save(many))).toEqual([
      { path: ["entries"], message: "Too many changes at once" },
    ]);
  });

  it("refuses a date that is not a real date", () => {
    for (const date of ["2026-02-30", "09/11/2026"]) {
      expect(issues(save([entry()], date))).toEqual([
        { path: ["date"], message: "Date must be a real date like 2026-11-09" },
      ]);
    }
  });
});

describe("parseAttendanceFilters", () => {
  it("gives today and the defaults for an empty query", () => {
    expect(parseAttendanceFilters({}, TODAY)).toEqual({
      date: TODAY,
      locationId: null,
      departmentId: null,
      shiftId: null,
      status: "all",
      query: "",
    });
  });

  it("keeps a valid date", () => {
    expect(parseAttendanceFilters({ date: "2026-11-12" }, TODAY).date).toBe("2026-11-12");
  });

  it("falls back to today for a malformed or impossible date", () => {
    for (const date of ["nope", "2026-02-30", "", "2026-11-9"]) {
      expect(parseAttendanceFilters({ date }, TODAY).date).toBe(TODAY);
    }
  });

  it("keeps a known status and falls back to all for anything else", () => {
    expect(parseAttendanceFilters({ status: "absent" }, TODAY).status).toBe("absent");
    expect(parseAttendanceFilters({ status: "sick" }, TODAY).status).toBe("all");
    expect(parseAttendanceFilters({ status: "leave" }, TODAY).status).toBe("all");
    expect(parseAttendanceFilters({ status: "not-marked" }, TODAY).status).toBe("not-marked");
    expect(parseAttendanceFilters({ status: "late" }, TODAY).status).toBe("all");
  });

  it("keeps a uuid for each id filter and gives null for anything else", () => {
    const parsed = parseAttendanceFilters(
      { location: "not-a-uuid", department: ID_1, shift: "" },
      TODAY,
    );

    expect(parsed.locationId).toBeNull();
    expect(parsed.departmentId).toBe(ID_1);
    expect(parsed.shiftId).toBeNull();
    expect(parseAttendanceFilters({ location: ID_1 }, TODAY).locationId).toBe(ID_1);
  });

  it("ignores a site param, which no longer exists", () => {
    expect(parseAttendanceFilters({ site: ID_1 }, TODAY)).not.toHaveProperty("siteId");
  });

  it("uses the first element of an array value", () => {
    const parsed = parseAttendanceFilters({ date: ["2026-11-12", "2026-11-13"] }, TODAY);

    expect(parsed.date).toBe("2026-11-12");
  });

  it("trims the query and cuts it to 100 characters", () => {
    expect(parseAttendanceFilters({ q: "  Citra  " }, TODAY).query).toBe("Citra");
    expect(parseAttendanceFilters({ q: "a".repeat(150) }, TODAY).query).toHaveLength(100);
  });
});
