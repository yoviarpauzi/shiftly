import { describe, expect, it } from "vitest";

import type { AttendanceDraftRow, AttendanceFormRow, AttendanceStatus } from "@/types/attendance";

import {
  ATTENDANCE_STATUS_LABELS,
  attendanceFormKey,
  attendanceLock,
  canReplace,
  changedEntries,
  formatAttendanceDate,
  locationViewFor,
  rowLocationLabel,
  rowsSignature,
  isFutureDay,
  markAllPresent,
  NOT_SCHEDULED_MESSAGE,
  replacementConfirmText,
  replaceHint,
  rowsLosingReplacement,
  SAVE_FIRST_HINT,
  scheduledWorkError,
  substituteLabel,
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
  locationName: "Gudang Utara",
  shiftOrder: 1,
  shiftName: "Pagi",
  startTime: "07:00",
  endTime: "15:00",
  status: null,
  substitute: null,
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
        formRow({ assignmentId: "a2", status: "absent", reason: "Fever", draftStatus: "absent", draftReason: "Fever" }),
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
        formRow({ status: "absent", reason: "Fever", draftStatus: "absent", draftReason: "Flu" }),
      ]),
    ).toEqual([{ assignmentId: "a1", status: "absent", reason: "Flu" }]);
  });

  it("clears a worker set back to Not marked, with no reason", () => {
    expect(
      changedEntries([
        formRow({ status: "absent", reason: "Fever", draftStatus: null, draftReason: "Fever" }),
      ]),
    ).toEqual([{ assignmentId: "a1", status: null, reason: null }]);
  });

  it("ignores a reason typed while the worker is Not marked and was never marked", () => {
    expect(changedEntries([formRow({ draftStatus: null, draftReason: "stray" })])).toEqual([]);
  });

  it("treats a saved null reason and an empty draft as the same", () => {
    expect(
      changedEntries([formRow({ status: "present", reason: null, draftStatus: "present", draftReason: "" })]),
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
      notMarked: 0,
      covered: 0,
    });
  });

  it("counts every status and the rows that are not marked", () => {
    const summary = summarize(
      rows("present", "present", "absent", "absent", "present", null, null),
    );

    expect(summary).toEqual({
      scheduled: 7,
      present: 3,
      absent: 2,
      notMarked: 2,
      covered: 0,
    });
  });

  it("reports the covered count it is given", () => {
    expect(summarize(rows("present", "absent", "absent"), 2).covered).toBe(2);
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
    { assignmentId: "b", status: "absent", reason: "Fever" },
    { assignmentId: "c", status: null, reason: "kept" },
  ];

  it("sets Present only where the status is null, and keeps every reason", () => {
    expect(markAllPresent(input)).toEqual([
      { assignmentId: "a", status: "present", reason: null },
      { assignmentId: "b", status: "absent", reason: "Fever" },
      { assignmentId: "c", status: "present", reason: "kept" },
    ]);
  });

  it("does not change its input", () => {
    markAllPresent(input);

    expect(input[0].status).toBeNull();
  });
});

describe("attendanceFormKey", () => {
  const saved = [
    { assignmentId: "a", status: null, reason: null },
    { assignmentId: "b", status: "present" as const, reason: null },
  ];

  it("is the same for the same day, location and saved rows", () => {
    expect(attendanceFormKey("2026-11-09", "l1", saved)).toBe(
      attendanceFormKey("2026-11-09", "l1", [...saved]),
    );
  });

  it("changes with the day", () => {
    expect(attendanceFormKey("2026-11-10", "l1", saved)).not.toBe(
      attendanceFormKey("2026-11-09", "l1", saved),
    );
  });

  it("changes when the location goes from one to All, so a draft is not carried into the view", () => {
    expect(attendanceFormKey("2026-11-09", null, saved)).not.toBe(
      attendanceFormKey("2026-11-09", "l1", saved),
    );
  });

  it("changes when a saved status or reason changes", () => {
    const after = [saved[0], { ...saved[1], status: "absent" as const, reason: "Fever" }];

    expect(attendanceFormKey("2026-11-09", "l1", after)).not.toBe(
      attendanceFormKey("2026-11-09", "l1", saved),
    );
  });
});

describe("attendanceLock", () => {
  it("is scope while no location is chosen, even on a future day", () => {
    expect(attendanceLock(null, false, 2)).toBe("scope");
    expect(attendanceLock(null, true, 2)).toBe("scope");
  });

  it("is future for a chosen location on a day after today", () => {
    expect(attendanceLock("l1", true, 2)).toBe("future");
  });

  it("is open for a chosen location on a day that can be marked", () => {
    expect(attendanceLock("l1", false, 2)).toBeNull();
  });

  it("does not ask to choose a location when the access has none to choose", () => {
    expect(attendanceLock(null, false, 0)).toBeNull();
    expect(attendanceLock(null, true, 0)).toBe("future");
  });
});

describe("locationViewFor", () => {
  it("shows no location column once a location is chosen", () => {
    expect(locationViewFor({ locationId: "l1" })).toBe("none");
  });

  it("shows the location name while the list spans locations", () => {
    expect(locationViewFor({ locationId: null })).toBe("location");
  });
});

describe("rowLocationLabel", () => {
  const row = { locationName: "Gudang" };

  it("gives nothing when the column is off", () => {
    expect(rowLocationLabel(row, "none")).toBeNull();
  });

  it("gives the location name alone, with no site in front", () => {
    expect(rowLocationLabel(row, "location")).toBe("Gudang");
  });
});

describe("formatAttendanceDate", () => {
  it("writes the weekday, the day without padding, the month, and the year", () => {
    expect(formatAttendanceDate("2026-11-09")).toBe("Mon, 9 Nov 2026");
  });

  it("handles the end of a year and the start of the next", () => {
    expect(formatAttendanceDate("2026-12-31")).toBe("Thu, 31 Dec 2026");
    expect(formatAttendanceDate("2027-01-01")).toBe("Fri, 1 Jan 2027");
  });

  it("handles a leap day", () => {
    expect(formatAttendanceDate("2028-02-29")).toBe("Tue, 29 Feb 2028");
  });
});

describe("canReplace", () => {
  it("is true for a saved Absent row that is not locked", () => {
    expect(canReplace({ status: "absent", draftStatus: "absent" }, false)).toBe(true);
  });

  it("is false when the draft moved away from the saved Absent", () => {
    expect(canReplace({ status: "absent", draftStatus: "present" }, false)).toBe(false);
    expect(canReplace({ status: "absent", draftStatus: null }, false)).toBe(false);
  });

  it("is false for an Absent that is not saved yet", () => {
    expect(canReplace({ status: null, draftStatus: "absent" }, false)).toBe(false);
    expect(canReplace({ status: "present", draftStatus: "absent" }, false)).toBe(false);
  });

  it("is false while the page is locked or saving", () => {
    expect(canReplace({ status: "absent", draftStatus: "absent" }, true)).toBe(false);
  });

  it("is false for a row that is not marked", () => {
    expect(canReplace({ status: null, draftStatus: null }, false)).toBe(false);
  });
});

describe("rowsLosingReplacement", () => {
  const substitute = { id: "s1", workerId: "w2", employeeId: "EMP2", name: "Sari" };

  it("returns a covered row whose draft is no longer Absent", () => {
    const row = formRow({ status: "absent", substitute, draftStatus: "present" });

    expect(rowsLosingReplacement([row])).toEqual([row]);
  });

  it("returns a covered row whose draft is cleared to Not marked", () => {
    const row = formRow({ status: "absent", substitute, draftStatus: null });

    expect(rowsLosingReplacement([row])).toEqual([row]);
  });

  it("keeps a covered row that is still Absent", () => {
    expect(
      rowsLosingReplacement([formRow({ status: "absent", substitute, draftStatus: "absent" })]),
    ).toEqual([]);
  });

  it("ignores a row without a replacement", () => {
    expect(
      rowsLosingReplacement([formRow({ status: "absent", draftStatus: "present" })]),
    ).toEqual([]);
  });
});

describe("replacementConfirmText", () => {
  it("names one worker", () => {
    expect(replacementConfirmText([formRow({ workerName: "Budi" })])).toBe(
      "The replacement of Budi will be removed because the status is no longer Absent.",
    );
  });

  it("names several workers", () => {
    expect(
      replacementConfirmText([
        formRow({ workerName: "Budi" }),
        formRow({ assignmentId: "a2", workerName: "Ani" }),
      ]),
    ).toBe("The replacement of Budi, Ani will be removed because the status is no longer Absent.");
  });
});

describe("substituteLabel", () => {
  it("gives the name and the employee id", () => {
    const substitute = { id: "s1", workerId: "w2", employeeId: "EMP1", name: "Sari" };

    expect(substituteLabel(substitute)).toBe("Replaced by Sari (EMP1)");
  });
});

describe("a replacement in the form key", () => {
  const base = { assignmentId: "a1", status: "absent", reason: null } as const;

  it("changes when only the replacement changes", () => {
    const none = rowsSignature([{ ...base, substitute: null }]);
    const first = rowsSignature([{ ...base, substitute: { id: "s1" } }]);
    const second = rowsSignature([{ ...base, substitute: { id: "s2" } }]);

    expect(first).not.toBe(none);
    expect(second).not.toBe(first);
    expect(
      attendanceFormKey("2026-11-09", "l1", [{ ...base, substitute: { id: "s1" } }]),
    ).not.toBe(attendanceFormKey("2026-11-09", "l1", [{ ...base, substitute: null }]));
  });

  it("is the same for a row without the field and one with null", () => {
    expect(rowsSignature([base])).toBe(rowsSignature([{ ...base, substitute: null }]));
  });
});

describe("replaceHint", () => {
  const saved = { status: "absent", draftStatus: "absent" } as const;

  it("asks to save first for a saved Absent row while other changes are unsaved", () => {
    expect(replaceHint(saved, { disabled: false, hasUnsavedChanges: true })).toBe(SAVE_FIRST_HINT);
    expect(SAVE_FIRST_HINT).toBe("Save your changes first");
  });

  it("gives no hint while the day is locked or saving", () => {
    expect(replaceHint(saved, { disabled: true, hasUnsavedChanges: true })).toBeNull();
    expect(replaceHint(saved, { disabled: true, hasUnsavedChanges: false })).toBeNull();
  });

  it("gives no hint for a row that is not a saved Absent row", () => {
    const options = { disabled: false, hasUnsavedChanges: true };

    expect(replaceHint({ status: null, draftStatus: null }, options)).toBeNull();
    expect(replaceHint({ status: "present", draftStatus: "present" }, options)).toBeNull();
    expect(replaceHint({ status: "absent", draftStatus: "present" }, options)).toBeNull();
    expect(replaceHint({ status: null, draftStatus: "absent" }, options)).toBeNull();
  });

  it("gives no hint when nothing is unsaved", () => {
    expect(replaceHint(saved, { disabled: false, hasUnsavedChanges: false })).toBeNull();
  });
});
