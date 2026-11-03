import { describe, expect, it } from "vitest";

import type { AttendanceDraftRow, AttendanceStatus } from "@/types/attendance";

import { ATTENDANCE_STATUS_LABELS, isFutureDay, markAllPresent, summarize } from "./attendance-rules";

const rows = (...statuses: (AttendanceStatus | null)[]) =>
  statuses.map((status) => ({ status }));

describe("ATTENDANCE_STATUS_LABELS", () => {
  it("names every status and Not marked", () => {
    expect(ATTENDANCE_STATUS_LABELS).toEqual({
      present: "Present",
      absent: "Absent",
      sick: "Sick",
      leave: "Leave",
      "not-marked": "Not marked",
    });
  });
});

describe("summarize", () => {
  it("gives zeros for a day with no rows", () => {
    expect(summarize([])).toEqual({
      scheduled: 0,
      present: 0,
      absent: 0,
      sick: 0,
      leave: 0,
      notMarked: 0,
    });
  });

  it("counts every status and the rows that are not marked", () => {
    const summary = summarize(
      rows("present", "present", "absent", "sick", "leave", null, null),
    );

    expect(summary).toEqual({
      scheduled: 7,
      present: 2,
      absent: 1,
      sick: 1,
      leave: 1,
      notMarked: 2,
    });
  });
});

describe("isFutureDay", () => {
  it("is true for a later day", () => {
    expect(isFutureDay("2026-11-10", "2026-11-09")).toBe(true);
  });

  it("is false for today and for an earlier day", () => {
    expect(isFutureDay("2026-11-09", "2026-11-09")).toBe(false);
    expect(isFutureDay("2026-11-08", "2026-11-09")).toBe(false);
  });

  it("compares across a month and a year boundary", () => {
    expect(isFutureDay("2026-12-01", "2026-11-30")).toBe(true);
    expect(isFutureDay("2027-01-01", "2026-12-31")).toBe(true);
    expect(isFutureDay("2026-12-31", "2027-01-01")).toBe(false);
  });
});

describe("markAllPresent", () => {
  const input: AttendanceDraftRow[] = [
    { assignmentId: "a", status: null, reason: null },
    { assignmentId: "b", status: "sick", reason: "Fever" },
    { assignmentId: "c", status: null, reason: "kept" },
  ];

  it("sets Present only where the status is null, and keeps every reason", () => {
    expect(markAllPresent(input)).toEqual([
      { assignmentId: "a", status: "present", reason: null },
      { assignmentId: "b", status: "sick", reason: "Fever" },
      { assignmentId: "c", status: "present", reason: "kept" },
    ]);
  });

  it("does not change its input", () => {
    markAllPresent(input);

    expect(input[0].status).toBeNull();
  });
});
