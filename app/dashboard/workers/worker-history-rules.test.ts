import { describe, expect, it } from "vitest";
import type {
  HistoryAttendance,
  WorkerHistoryFilters,
  WorkerHistoryJoinedRow,
  WorkerHistoryRow,
} from "@/types/worker-history";
import {
  buildWorkerHistory,
  filterHistory,
  historyChoices,
  historyHref,
  monthBounds,
  monthLabel,
  shiftMonth,
  sortHistory,
  summarizeHistory,
  toHistoryRows,
  weekdayName,
  workerToday,
} from "./worker-history-rules";

const TODAY = "2026-11-12";
const DEPT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEPT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SHIFT_1 = "11111111-1111-4111-8111-111111111111";
const SHIFT_2 = "22222222-2222-4222-8222-222222222222";

let counter = 0;

// A work row on S1 in department A, present. Each override changes one thing.
function row(overrides: Partial<WorkerHistoryRow> = {}): WorkerHistoryRow {
  counter += 1;

  return {
    assignmentId: `assignment-${String(counter).padStart(3, "0")}`,
    date: "2026-11-10",
    kind: "work",
    shift: { id: SHIFT_1, order: 1, name: "Shift 1", startTime: "07:00", endTime: "15:00" },
    departmentId: DEPT_A,
    departmentName: "Produksi",
    subDepartmentName: null,
    positionName: "Operator Produksi",
    rosterId: "roster-1",
    poNumber: "PO-NK-202611-0001",
    attendance: "present",
    ...overrides,
  };
}

function off(overrides: Partial<WorkerHistoryRow> = {}): WorkerHistoryRow {
  return row({ kind: "off", shift: null, attendance: null, ...overrides });
}

const ALL: WorkerHistoryFilters = {
  month: "2026-11",
  departmentId: null,
  shiftId: null,
  type: "all",
  attendance: "all",
};

function workRows(count: number, attendance: HistoryAttendance): WorkerHistoryRow[] {
  return Array.from({ length: count }, () => row({ attendance }));
}

describe("monthBounds", () => {
  it("runs a past month to its last day", () => {
    expect(monthBounds("2026-02", TODAY)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("knows a leap February", () => {
    expect(monthBounds("2028-02", "2028-11-01").to).toBe("2028-02-29");
  });

  it("stops the current month at today", () => {
    expect(monthBounds("2026-11", TODAY)).toEqual({ from: "2026-11-01", to: "2026-11-12" });
  });
});

describe("month helpers", () => {
  it("steps across a year boundary", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("labels a month in English", () => {
    expect(monthLabel("2026-11")).toBe("November 2026");
  });

  it("names the weekday of a date", () => {
    expect(weekdayName("2026-11-12")).toBe("Thursday");
    expect(weekdayName("2026-11-08")).toBe("Sunday");
  });
});

describe("workerToday", () => {
  it("gives the date in the worker's zone", () => {
    expect(workerToday("Asia/Jakarta", new Date("2026-11-11T18:30:00Z"))).toBe("2026-11-12");
  });

  it("falls back to the default zone for an unknown one", () => {
    expect(workerToday("Mars/Olympus", new Date("2026-11-11T18:30:00Z"))).toBe("2026-11-12");
  });
});

describe("toHistoryRows", () => {
  const joined: WorkerHistoryJoinedRow = {
    assignmentId: "a-1",
    date: "2026-11-12",
    kind: "work",
    shiftId: SHIFT_1,
    shiftOrder: 1,
    shiftName: "Shift 1",
    startTime: "07:00:00",
    endTime: "15:00:00",
    departmentId: DEPT_A,
    departmentName: "Produksi",
    subDepartmentName: "Line Pengemasan",
    positionName: "Operator Produksi",
    rosterId: "roster-1",
    poNumber: "PO-NK-202611-0003",
    attendanceStatus: null,
  };

  it("marks a work row without a record as not-marked and trims the times", () => {
    const [result] = toHistoryRows([joined]);

    expect(result.attendance).toBe("not-marked");
    expect(result.shift).toEqual({
      id: SHIFT_1,
      order: 1,
      name: "Shift 1",
      startTime: "07:00",
      endTime: "15:00",
    });
  });

  it("keeps a recorded status", () => {
    expect(toHistoryRows([{ ...joined, attendanceStatus: "sick" }])[0].attendance).toBe("sick");
  });

  it("gives an off row no shift and no attendance", () => {
    const [result] = toHistoryRows([
      {
        ...joined,
        kind: "off",
        shiftId: null,
        shiftOrder: null,
        shiftName: null,
        startTime: null,
        endTime: null,
      },
    ]);

    expect(result.shift).toBeNull();
    expect(result.attendance).toBeNull();
  });
});

describe("summarizeHistory", () => {
  it("counts days by kind and work days by attendance", () => {
    const rows = [
      ...workRows(6, "present"),
      ...workRows(1, "absent"),
      ...workRows(1, "sick"),
      ...workRows(1, "not-marked"),
      off(),
      off(),
      row({ kind: "break", shift: null, attendance: null }),
    ];

    expect(summarizeHistory(rows)).toEqual({
      shiftsWorked: 9,
      offDays: 2,
      breakDays: 1,
      present: 6,
      absent: 1,
      sick: 1,
      leave: 0,
      notMarked: 1,
    });
  });
});

describe("filterHistory", () => {
  const rows = [
    row({ departmentId: DEPT_A, attendance: "present" }),
    row({
      departmentId: DEPT_B,
      departmentName: "Gudang",
      attendance: "absent",
      shift: { id: SHIFT_2, order: 2, name: "Shift 2", startTime: "15:00", endTime: "23:00" },
    }),
    row({ attendance: "not-marked" }),
    off(),
  ];

  it("filters by department", () => {
    expect(filterHistory(rows, { ...ALL, departmentId: DEPT_B })).toHaveLength(1);
  });

  it("filters by shift and drops rows without one", () => {
    expect(filterHistory(rows, { ...ALL, shiftId: SHIFT_1 })).toHaveLength(2);
  });

  it("filters by type", () => {
    expect(filterHistory(rows, { ...ALL, type: "off" })).toHaveLength(1);
  });

  it("keeps off rows out of an attendance filter", () => {
    expect(filterHistory(rows, { ...ALL, attendance: "present" })).toHaveLength(1);
  });

  it("keeps only unmarked work rows for not-marked", () => {
    const result = filterHistory(rows, { ...ALL, attendance: "not-marked" });

    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("work");
  });

  it("combines department and shift", () => {
    expect(filterHistory(rows, { ...ALL, departmentId: DEPT_A, shiftId: SHIFT_2 })).toHaveLength(0);
  });
});

describe("sortHistory", () => {
  const newer = row({ assignmentId: "x-2", date: "2026-11-11" });
  const older = row({ assignmentId: "x-1", date: "2026-11-10" });

  it("puts the newest date first when descending", () => {
    expect(sortHistory([older, newer], "desc").map((entry) => entry.date)).toEqual([
      "2026-11-11",
      "2026-11-10",
    ]);
  });

  it("reverses only the dates when ascending", () => {
    expect(sortHistory([newer, older], "asc").map((entry) => entry.date)).toEqual([
      "2026-11-10",
      "2026-11-11",
    ]);
  });

  it("orders one date by shift order, then assignment id", () => {
    const s2 = row({
      assignmentId: "a",
      shift: { id: SHIFT_2, order: 2, name: "Shift 2", startTime: "15:00", endTime: "23:00" },
    });
    const s1b = row({ assignmentId: "c" });
    const s1a = row({ assignmentId: "b" });

    expect(sortHistory([s2, s1b, s1a], "desc").map((entry) => entry.assignmentId)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});

describe("historyChoices", () => {
  it("lists each department and shift once, even a deleted one, and skips off rows", () => {
    const choices = historyChoices([
      row({ departmentId: DEPT_B, departmentName: "Gudang (deleted)" }),
      row({ departmentId: DEPT_A }),
      row({ departmentId: DEPT_A }),
      off(),
    ]);

    expect(choices.departments).toEqual([
      { id: DEPT_B, name: "Gudang (deleted)" },
      { id: DEPT_A, name: "Produksi" },
    ]);
    expect(choices.shifts).toEqual([{ id: SHIFT_1, order: 1, name: "Shift 1" }]);
  });
});

describe("buildWorkerHistory", () => {
  const rows = Array.from({ length: 12 }, (_, index) =>
    row({ date: `2026-11-${String(index + 1).padStart(2, "0")}` }),
  );

  it("clamps a page past the end to the last page", () => {
    const view = buildWorkerHistory(rows, ALL, { page: 99, pageSize: 10, direction: "desc" });

    expect(view.page).toBe(2);
    expect(view.rows).toHaveLength(2);
    expect(view.total).toBe(12);
  });

  it("keeps the summary and choices on all rows while a filter narrows the list", () => {
    const plain = buildWorkerHistory(rows, ALL, { page: 1, pageSize: 10, direction: "desc" });
    const narrowed = buildWorkerHistory(
      rows,
      { ...ALL, type: "off" },
      { page: 1, pageSize: 10, direction: "desc" },
    );

    expect(narrowed.total).toBe(0);
    expect(narrowed.summary).toEqual(plain.summary);
    expect(narrowed.choices).toEqual(plain.choices);
  });
});

describe("historyHref", () => {
  it("replaces a changed key in place and drops the page", () => {
    expect(
      historyHref("w1", { month: "2026-10", page: "2", department: "d1" }, { month: "2026-09" }),
    ).toBe("/dashboard/workers/w1?month=2026-09&department=d1");
  });

  it("has no query when nothing is left", () => {
    expect(historyHref("w1", {}, {})).toBe("/dashboard/workers/w1");
  });

  it("removes a key whose change is null and appends a new one", () => {
    expect(historyHref("w1", { department: "d1" }, { department: null, type: "off" })).toBe(
      "/dashboard/workers/w1?type=off",
    );
  });
});
