import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

const {
  busyWorkersQuery,
  buildConflictViews,
  buildGenerateLines,
  buildLineViews,
  confirmedWorkQuery,
  otherRosterWorkQuery,
  lineTitle,
  rosterCounts,
  shapeRosterRow,
  workerHistory,
} = await import("./rosters");

const DAYS = ["2026-11-09", "2026-11-10", "2026-11-11"];

describe("shapeRosterRow", () => {
  const base = {
    requestId: "r1",
    poNumber: "PO-NSL-202611-0001",
    type: "weekly",
    startDate: "2026-11-09",
    locationName: "Gudang A",
    siteName: "Nestle Kejayan",
    rosterId: null,
    rosterStatus: null,
    conflictCount: null,
    updatedAt: null,
  };

  it("shows an approved request with no roster as not generated, with nothing to open", () => {
    expect(shapeRosterRow(base)).toEqual({
      requestId: "r1",
      poNumber: "PO-NSL-202611-0001",
      type: "weekly",
      startDate: "2026-11-09",
      days: 7,
      locationName: "Gudang A",
      siteName: "Nestle Kejayan",
      status: "not-generated",
      conflictCount: null,
      updatedAt: null,
      rosterId: null,
    });
  });

  it("counts one day for a daily request", () => {
    expect(shapeRosterRow({ ...base, type: "daily" }).days).toBe(1);
  });

  it("carries the roster's status, conflict count, and version", () => {
    const updatedAt = new Date("2026-11-03T10:00:00.000Z");

    expect(
      shapeRosterRow({
        ...base,
        rosterId: "ro1",
        rosterStatus: "draft",
        conflictCount: 3,
        updatedAt,
      }),
    ).toMatchObject({
      status: "draft",
      conflictCount: 3,
      updatedAt: "2026-11-03T10:00:00.000Z",
      rosterId: "ro1",
    });
  });

  it("shows zero conflicts as 0, not as missing", () => {
    expect(
      shapeRosterRow({
        ...base,
        rosterId: "ro1",
        rosterStatus: "confirmed",
        conflictCount: 0,
        updatedAt: new Date("2026-11-03T10:00:00.000Z"),
      }).conflictCount,
    ).toBe(0);
  });
});

// A roster whose request was cancelled stays on record, but its work days must not block or
// count against anyone in another roster. Each of the three reads that look at other rosters is
// rendered to SQL here, since the recorder in the action tests cannot run a WHERE clause.
describe("reads of other rosters leave out a request that is no longer approved", () => {
  const reader = drizzle.mock();
  const ID = "11111111-1111-4111-8111-111111111111";

  const cases: [string, () => { toSQL: () => { sql: string; params: unknown[] } }][] = [
    ["the workers busy in another roster", () => busyWorkersQuery(reader, ID, "2026-11-09", "2026-11-15")],
    [
      "another roster's work days for a candidate",
      () => otherRosterWorkQuery(reader, ID, [ID], ["2026-11-09"]),
    ],
    [
      "the confirmed work a history is built from",
      () => confirmedWorkQuery(reader, [ID], "2026-11-09", "2026-11-15"),
    ],
  ];

  it.each(cases)("%s", (_label, build) => {
    const { sql, params } = build().toSQL();

    expect(sql).toContain('"roster_request"."status" = $');
    expect(params).toContain("approved");
  });

  // A confirmed roster's own work rows would otherwise count twice: once as history, once as cells.
  it("leaves the excluded roster out of the confirmed work", () => {
    const ROSTER = "22222222-2222-4222-8222-222222222222";
    const { sql, params } = confirmedWorkQuery(reader, [ID], "2026-11-09", "2026-11-15", ROSTER).toSQL();

    expect(sql).toContain('"roster"."id" <> $');
    expect(params).toContain(ROSTER);
  });

  it("reads every roster's confirmed work when none is excluded", () => {
    const { sql } = confirmedWorkQuery(reader, [ID], "2026-11-09", "2026-11-15").toSQL();

    expect(sql).not.toContain('"roster"."id" <> $');
  });
});

describe("lineTitle", () => {
  it("joins department, sub-department, and position", () => {
    expect(lineTitle("Produksi", "Packing", "Operator")).toBe("Produksi / Packing / Operator");
  });

  it("leaves out a missing sub-department", () => {
    expect(lineTitle("Gudang", null, "Forklift")).toBe("Gudang / Forklift");
  });
});

const LINES = [
  { lineId: "l1", title: "Produksi / Packing / Operator", shiftLabel: "Any shift", perDay: [2, 2, 2] },
  { lineId: "l2", title: "Gudang / Forklift", shiftLabel: "Shift 1", perDay: [1, 1, 1] },
];

const assignment = (
  lineId: string,
  workerId: string,
  employeeId: string,
  date: string,
  kind: "work" | "off" | "break",
  shiftOrder: number | null,
) => ({ lineId, workerId, employeeId, name: `Name ${employeeId}`, date, kind, shiftOrder });

// No cell edited and no warning.
const NO_KEYS = { editedKeys: new Set<string>(), warningKeys: new Set<string>() };

const plain = { edited: false, warning: false };

describe("buildLineViews", () => {
  it("carries each line's shift label next to its unchanged title", () => {
    const views = buildLineViews({
      days: DAYS,
      lines: LINES,
      assignments: [],
      conflicts: [],
      replacedIn: [],
      ...NO_KEYS,
    });

    expect(views.map((view) => [view.title, view.shiftLabel])).toEqual([
      ["Produksi / Packing / Operator", "Any shift"],
      ["Gudang / Forklift", "Shift 1"],
    ]);
  });

  it("gives one cell per day, null for a day with no assignment", () => {
    const [first] = buildLineViews({
      days: DAYS,
      lines: LINES,
      assignments: [assignment("l1", "w1", "E1", "2026-11-10", "work", 2)],
      conflicts: [],
      replacedIn: [],
      ...NO_KEYS,
    });

    expect(first.workers).toHaveLength(1);
    expect(first.workers[0].cells).toEqual([null, { kind: "work", shiftOrder: 2, ...plain }, null]);
  });

  it("flags only the keyed cells as edited or warned, and keeps empty days null", () => {
    const [first, second] = buildLineViews({
      days: DAYS,
      lines: LINES,
      assignments: [
        assignment("l1", "w1", "E1", "2026-11-09", "work", 1),
        assignment("l1", "w1", "E1", "2026-11-10", "off", null),
        assignment("l2", "w1", "E1", "2026-11-09", "work", 1),
      ],
      conflicts: [],
      replacedIn: [],
      editedKeys: new Set(["l1|w1|2026-11-10", "l1|w1|2026-11-11"]),
      warningKeys: new Set(["l1|w1|2026-11-09", "l1|w1|2026-11-11"]),
    });

    expect(first.workers[0].cells).toEqual([
      { kind: "work", shiftOrder: 1, edited: false, warning: true },
      { kind: "off", edited: true, warning: false },
      null,
    ]);
    expect(second.workers[0].cells).toEqual([{ kind: "work", shiftOrder: 1, ...plain }, null, null]);
  });

  it("maps off and break days to their own cells", () => {
    const [first] = buildLineViews({
      days: DAYS,
      lines: LINES,
      assignments: [
        assignment("l1", "w1", "E1", "2026-11-09", "work", 1),
        assignment("l1", "w1", "E1", "2026-11-10", "off", null),
        assignment("l1", "w1", "E1", "2026-11-11", "break", null),
      ],
      conflicts: [],
      replacedIn: [],
      ...NO_KEYS,
    });

    expect(first.workers[0].cells).toEqual([
      { kind: "work", shiftOrder: 1, ...plain },
      { kind: "off", ...plain },
      { kind: "break", ...plain },
    ]);
  });

  it("keeps each line's workers apart and orders them by employee ID", () => {
    const [first, second] = buildLineViews({
      days: DAYS,
      lines: LINES,
      assignments: [
        assignment("l1", "w2", "b-2", "2026-11-09", "work", 1),
        assignment("l1", "w1", "A-1", "2026-11-09", "work", 1),
        assignment("l2", "w3", "C-3", "2026-11-09", "work", 1),
      ],
      conflicts: [],
      replacedIn: [],
      ...NO_KEYS,
    });

    expect(first.workers.map((worker) => worker.employeeId)).toEqual(["A-1", "b-2"]);
    expect(second.workers.map((worker) => worker.employeeId)).toEqual(["C-3"]);
  });

  it("marks the worker who took over a row as replaced, and only on that line", () => {
    const [first, second] = buildLineViews({
      days: DAYS,
      lines: LINES,
      assignments: [
        assignment("l1", "w1", "E1", "2026-11-09", "work", 1),
        assignment("l1", "w2", "E2", "2026-11-09", "work", 1),
        assignment("l2", "w1", "E1", "2026-11-10", "work", 1),
      ],
      conflicts: [],
      replacedIn: [{ lineId: "l1", workerId: "w1" }],
      ...NO_KEYS,
    });

    expect(first.workers.map((worker) => worker.replaced)).toEqual([true, false]);
    expect(second.workers[0].replaced).toBe(false);
  });

  it("builds the unfilled list from the line's conflicts", () => {
    const [first, second] = buildLineViews({
      days: DAYS,
      lines: LINES,
      assignments: [],
      conflicts: [
        { lineId: "l1", date: "2026-11-10", shiftOrder: 2, shortfall: 1, message: "Short by 1." },
        { lineId: "l1", date: "2026-11-09", shiftOrder: 1, shortfall: 2, message: "Short by 2." },
        { lineId: "l1", date: "2026-11-09", shiftOrder: null, shortfall: 5, message: "Short." },
      ],
      replacedIn: [],
      ...NO_KEYS,
    });

    expect(first.unfilled).toEqual([
      { date: "2026-11-09", shiftOrder: 1, shortfall: 2 },
      { date: "2026-11-10", shiftOrder: 2, shortfall: 1 },
    ]);
    expect(second.unfilled).toEqual([]);
  });

  it("passes the line's title and per-day headcounts through", () => {
    const [first] = buildLineViews({
      days: DAYS,
      lines: LINES,
      assignments: [],
      conflicts: [],
      replacedIn: [],
      ...NO_KEYS,
    });

    expect(first).toMatchObject({ lineId: "l1", title: "Produksi / Packing / Operator", perDay: [2, 2, 2] });
  });
});

describe("buildConflictViews", () => {
  it("names the line and orders by date, then line, then shift", () => {
    expect(
      buildConflictViews(LINES, [
        { lineId: "l2", date: "2026-11-09", shiftOrder: 1, shortfall: 1, message: "b" },
        { lineId: "l1", date: "2026-11-10", shiftOrder: 1, shortfall: 1, message: "c" },
        { lineId: "l1", date: "2026-11-09", shiftOrder: 3, shortfall: 2, message: "a2" },
        { lineId: "l1", date: "2026-11-09", shiftOrder: 1, shortfall: 1, message: "a1" },
      ]).map((conflict) => [conflict.lineTitle, conflict.date, conflict.shiftOrder, conflict.message]),
    ).toEqual([
      ["Produksi / Packing / Operator", "2026-11-09", 1, "a1"],
      ["Produksi / Packing / Operator", "2026-11-09", 3, "a2"],
      ["Gudang / Forklift", "2026-11-09", 1, "b"],
      ["Produksi / Packing / Operator", "2026-11-10", 1, "c"],
    ]);
  });
});

describe("rosterCounts", () => {
  it("counts distinct workers, work assignments, conflicts, edits, and warnings", () => {
    expect(
      rosterCounts(
        [
          assignment("l1", "w1", "E1", "2026-11-09", "work", 1),
          assignment("l1", "w1", "E1", "2026-11-10", "work", 1),
          assignment("l1", "w1", "E1", "2026-11-11", "off", null),
          assignment("l1", "w2", "E2", "2026-11-09", "work", 2),
        ],
        3,
        1,
        2,
      ),
    ).toEqual({ workers: 2, shiftsAssigned: 3, conflicts: 3, edits: 1, warnings: 2 });
  });

  it("is all zeros for an empty roster", () => {
    expect(rosterCounts([], 0, 0, 0)).toEqual({
      workers: 0,
      shiftsAssigned: 0,
      conflicts: 0,
      edits: 0,
      warnings: 0,
    });
  });
});

describe("workerHistory", () => {
  const rows = (...entries: [string, number][]) =>
    entries.map(([date, shiftOrder]) => ({ date, shiftOrder }));

  it("has no history for a worker with no confirmed work", () => {
    expect(workerHistory("w1", [], "2026-11-09", ["2026-11"])).toEqual({
      workerId: "w1",
      lastWorkDate: null,
      lastShiftOrder: null,
      consecutiveWorkDays: 0,
      monthWorkDays: {},
    });
  });

  it("takes the last work day before the first day and counts the run that ends there", () => {
    expect(
      workerHistory(
        "w1",
        rows(["2026-11-03", 1], ["2026-11-05", 1], ["2026-11-06", 2], ["2026-11-07", 3], ["2026-11-08", 3]),
        "2026-11-09",
        ["2026-11"],
      ),
    ).toEqual({
      workerId: "w1",
      lastWorkDate: "2026-11-08",
      lastShiftOrder: 3,
      consecutiveWorkDays: 4,
      monthWorkDays: { "2026-11": 5 },
    });
  });

  it("breaks the run at a gap", () => {
    expect(
      workerHistory("w1", rows(["2026-11-05", 1], ["2026-11-08", 2]), "2026-11-09", ["2026-11"])
        .consecutiveWorkDays,
    ).toBe(1);
  });

  it("ignores work on or after the first day for the run, but counts it in the month", () => {
    expect(
      workerHistory("w1", rows(["2026-11-08", 1], ["2026-11-12", 2]), "2026-11-09", ["2026-11"]),
    ).toMatchObject({
      lastWorkDate: "2026-11-08",
      lastShiftOrder: 1,
      consecutiveWorkDays: 1,
      monthWorkDays: { "2026-11": 2 },
    });
  });

  it("counts only the months the roster touches", () => {
    expect(
      workerHistory(
        "w1",
        rows(["2026-10-30", 1], ["2026-10-31", 1], ["2026-11-02", 1]),
        "2026-11-09",
        ["2026-11"],
      ).monthWorkDays,
    ).toEqual({ "2026-11": 1 });
  });

  it("counts a roster that spans two months in each of them", () => {
    expect(
      workerHistory(
        "w1",
        rows(["2026-10-30", 1], ["2026-10-31", 1], ["2026-11-02", 1]),
        "2026-11-09",
        ["2026-10", "2026-11"],
      ).monthWorkDays,
    ).toEqual({ "2026-10": 2, "2026-11": 1 });
  });
});

describe("buildGenerateLines", () => {
  const days = ["2026-11-09", "2026-11-10", "2026-11-11"];
  const shiftIds = ["s1", "s2", "s3"];
  const anyLine = {
    lineId: "l1",
    title: "Produksi / Packing / Operator",
    shiftLabel: "Any shift",
    shiftId: null,
    perDay: [6, 0, 4],
  };
  const fixedLine = {
    lineId: "l2",
    title: "Gudang / Forklift",
    shiftLabel: "Shift 2",
    shiftId: "s2",
    perDay: [2, 2, 0],
  };

  it("starts an Any shift line from an even split when there is no roster", () => {
    const [line] = buildGenerateLines({ days, shiftIds, lines: [anyLine], stored: null });

    expect(line.split).toEqual([
      [2, 2, 2],
      [0, 0, 0],
      [2, 1, 1],
    ]);
    expect(line).toMatchObject({ shiftLabel: "Any shift", fixedShiftId: null, required: [6, 0, 4] });
  });

  it("starts an Any shift line from the stored split when a roster exists", () => {
    const stored = new Map([["l1|2026-11-09|s1", 6]]);
    const [line] = buildGenerateLines({ days, shiftIds, lines: [anyLine], stored });

    expect(line.split[0]).toEqual([6, 0, 0]);
    expect(line.split[2]).toEqual([0, 0, 0]);
  });

  it("gives a fixed line the whole headcount on its shift, also when a roster exists", () => {
    const stored = new Map([["l2|2026-11-09|s1", 2]]);
    const [line] = buildGenerateLines({ days, shiftIds, lines: [fixedLine], stored });

    expect(line.split).toEqual([
      [0, 2, 0],
      [0, 2, 0],
      [0, 0, 0],
    ]);
    expect(line).toMatchObject({ shiftLabel: "Shift 2", fixedShiftId: "s2" });
  });

  it("leaves the split of a line empty per day when the site has no shifts", () => {
    const [line] = buildGenerateLines({ days, shiftIds: [], lines: [anyLine], stored: null });

    expect(line.split).toEqual([[], [], []]);
  });
});
