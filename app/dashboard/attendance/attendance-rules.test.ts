import { describe, expect, it } from "vitest";

import type { AttendanceDraftRow, AttendanceFormRow, AttendanceStatus } from "@/types/attendance";

import {
  ATTENDANCE_STATUS_LABELS,
  changedEntries,
  rowsSignature,
  isFutureDay,
  markAllPresent,
  NOT_SCHEDULED_MESSAGE,
  scheduledWorkError,
  summarize,
} from "./attendance-rules";

const rows = (...statuses: (AttendanceStatus | null)[]) =>
  statuses.map((status) => ({ status }));

const formRow = (overrides: Partial<AttendanceFormRow> = {}): AttendanceFormRow => ({
  assignmentId: "a1",
  employeeId: "E-1",
  workerName: "Budi",
  departmentName: "Produksi",
  positionName: "Operator",
  shiftOrder: 1,
  shiftName: "Pagi",
  startTime: "07:00",
  endTime: "15:00",
  status: null,
  reason: null,
  draftStatus: null,
  draftReason: "",
  ...overrides,
});

describe("changedEntries", () => {
  it("gives nothing when the form matches what is saved", () => {
    expect(
      changedEntries([
        formRow(),
        formRow({ assignmentId: "a2", status: "sick", reason: "Fever", draftStatus: "sick", draftReason: "Fever" }),
      ]),
    ).toEqual([]);
  });

  it("gives a newly marked worker with the trimmed reason", () => {
    expect(
      changedEntries([formRow({ draftStatus: "present", draftReason: "  on time  " })]),
    ).toEqual([{ assignmentId: "a1", status: "present", reason: "on time" }]);
  });

  it("gives a blank reason as null", () => {
    expect(changedEntries([formRow({ draftStatus: "absent", draftReason: "   " })])).toEqual([
      { assignmentId: "a1", status: "absent", reason: null },
    ]);
  });

  it("gives a changed reason on its own", () => {
    expect(
      changedEntries([
        formRow({ status: "sick", reason: "Fever", draftStatus: "sick", draftReason: "Flu" }),
      ]),
    ).toEqual([{ assignmentId: "a1", status: "sick", reason: "Flu" }]);
  });

  it("clears a worker set back to Not marked, with no reason", () => {
    expect(
      changedEntries([
        formRow({ status: "sick", reason: "Fever", draftStatus: null, draftReason: "Fever" }),
      ]),
    ).toEqual([{ assignmentId: "a1", status: null, reason: null }]);
  });

  it("ignores a reason typed while the worker is Not marked and was never marked", () => {
    expect(changedEntries([formRow({ draftStatus: null, draftReason: "stray" })])).toEqual([]);
  });

  it("treats a saved null reason and an empty draft as the same", () => {
    expect(
      changedEntries([formRow({ status: "leave", reason: null, draftStatus: "leave", draftReason: "" })]),
    ).toEqual([]);
  });
});

describe("rowsSignature", () => {
  const row = { assignmentId: "a1", status: "present", reason: null } as const;

  it("is the same for the same rows", () => {
    expect(rowsSignature([row])).toBe(rowsSignature([{ ...row }]));
  });

  it("changes when a status, a reason, or the rows change", () => {
    const base = rowsSignature([row]);

    expect(rowsSignature([{ ...row, status: "absent" }])).not.toBe(base);
    expect(rowsSignature([{ ...row, reason: "Late bus" }])).not.toBe(base);
    expect(rowsSignature([{ ...row, status: null }])).not.toBe(base);
    expect(rowsSignature([row, { ...row, assignmentId: "a2" }])).not.toBe(base);
    expect(rowsSignature([])).not.toBe(base);
  });
});

describe("scheduledWorkError", () => {
  const scheduled = {
    kind: "work",
    workDate: "2026-11-09",
    rosterStatus: "confirmed",
    requestStatus: "approved",
  } as const;

  it("accepts a work assignment of a confirmed roster on the saved date", () => {
    expect(scheduledWorkError(scheduled, "2026-11-09")).toBeNull();
  });

  it("refuses an assignment of a draft roster", () => {
    expect(scheduledWorkError({ ...scheduled, rosterStatus: "draft" }, "2026-11-09")).toBe(
      NOT_SCHEDULED_MESSAGE,
    );
  });

  it("refuses an off day and a break day", () => {
    expect(scheduledWorkError({ ...scheduled, kind: "off" }, "2026-11-09")).toBe(
      NOT_SCHEDULED_MESSAGE,
    );
    expect(scheduledWorkError({ ...scheduled, kind: "break" }, "2026-11-09")).toBe(
      NOT_SCHEDULED_MESSAGE,
    );
  });

  it("refuses an assignment on a different date", () => {
    expect(scheduledWorkError(scheduled, "2026-11-10")).toBe(NOT_SCHEDULED_MESSAGE);
  });

  it("refuses an assignment whose request is no longer approved", () => {
    expect(scheduledWorkError({ ...scheduled, requestStatus: "cancelled" }, "2026-11-09")).toBe(
      NOT_SCHEDULED_MESSAGE,
    );
  });
});

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
