import { describe, expect, it } from "vitest";

import {
  confirmRosterSchema,
  generateRosterSchema,
  parseRosterFilters,
  replaceWorkerSchema,
} from "./rosters";

const REQUEST = "3f6c1c1e-8a53-4b7e-9d0a-5b1e2f7c9a10";
const LINE = "7b2d9f40-1c6e-4a8b-8e35-0d4c6a1f2b93";
const SHIFT_1 = "a1c4e2f6-5d3b-4c7a-9e18-6f2b0d8c4a57";
const SHIFT_2 = "c5e8a1b2-9d4f-4e6a-b7c3-2a1d8f0e6b49";
const WORKER_A = "d2f7b9c1-3a6e-4d58-8b10-7e4c9a2f5d36";
const WORKER_B = "e9a3c6d4-7b2f-4a15-9c80-1f5d3b8e2a74";

const target = (overrides: Record<string, unknown> = {}) => ({
  lineId: LINE,
  date: "2026-11-09",
  shiftId: SHIFT_1,
  headcount: 2,
  ...overrides,
});

const generate = (targets: unknown[], extra: Record<string, unknown> = {}) =>
  generateRosterSchema.safeParse({ requestId: REQUEST, targets, version: null, ...extra });

type Result = { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } };

function issues(result: Result) {
  return result.success ? [] : result.error!.issues.map((i) => ({ path: i.path, message: i.message }));
}

describe("generateRosterSchema", () => {
  it("accepts one valid target", () => {
    expect(generate([target()]).success).toBe(true);
  });

  it("accepts a version for generating again", () => {
    expect(generate([target()], { version: "2026-11-06T08:52:00.000Z" }).success).toBe(true);
  });

  it("refuses an empty list", () => {
    expect(issues(generate([]))).toEqual([{ path: ["targets"], message: "Nothing to generate" }]);
  });

  it("refuses ids that are not uuids", () => {
    expect(issues(generate([target()], { requestId: "x" }))).toEqual([
      { path: ["requestId"], message: "Choose a request" },
    ]);
    expect(issues(generate([target({ lineId: "x" })]))).toEqual([
      { path: ["targets", 0, "lineId"], message: "Choose a line" },
    ]);
    expect(issues(generate([target({ shiftId: "x" })]))).toEqual([
      { path: ["targets", 0, "shiftId"], message: "Choose a shift" },
    ]);
  });

  it("refuses a headcount that is not a whole number from 0 to 999", () => {
    for (const headcount of [-1, 1000, 2.5, Number.NaN]) {
      expect(issues(generate([target({ headcount })]))).toEqual([
        {
          path: ["targets", 0, "headcount"],
          message: "Headcount must be a whole number from 0 to 999",
        },
      ]);
    }
  });

  it("accepts the edges 0 and 999", () => {
    expect(generate([target({ headcount: 0 })]).success).toBe(true);
    expect(generate([target({ headcount: 999 })]).success).toBe(true);
  });

  it("refuses a date that is not a real date", () => {
    expect(issues(generate([target({ date: "2026-02-30" })]))).toEqual([
      { path: ["targets", 0, "date"], message: "Date must be a real date like 2026-11-09" },
    ]);
  });

  it("refuses the same line, date, and shift twice, on the second target", () => {
    expect(issues(generate([target(), target({ headcount: 3 })]))).toEqual([
      { path: ["targets", 1, "shiftId"], message: "Each shift can appear only once per day" },
    ]);
  });

  it("accepts the same line and date on different shifts, and the same shift on different days", () => {
    expect(generate([target(), target({ shiftId: SHIFT_2 })]).success).toBe(true);
    expect(generate([target(), target({ date: "2026-11-10" })]).success).toBe(true);
  });
});

describe("replaceWorkerSchema", () => {
  const base = {
    rosterId: REQUEST,
    lineId: LINE,
    fromWorkerId: WORKER_A,
    toWorkerId: WORKER_B,
    version: "2026-11-06T08:52:00.000Z",
  };

  it("accepts a valid replacement", () => {
    expect(replaceWorkerSchema.safeParse(base).success).toBe(true);
  });

  it("refuses a non-uuid for each id", () => {
    for (const key of ["rosterId", "lineId", "fromWorkerId", "toWorkerId"]) {
      expect(replaceWorkerSchema.safeParse({ ...base, [key]: "x" }).success).toBe(false);
    }
  });

  it("refuses replacing a worker with themselves", () => {
    const result = replaceWorkerSchema.safeParse({ ...base, toWorkerId: WORKER_A });

    expect(issues(result)).toEqual([
      { path: ["toWorkerId"], message: "Choose a different worker" },
    ]);
  });

  it("refuses an empty version", () => {
    expect(replaceWorkerSchema.safeParse({ ...base, version: "" }).success).toBe(false);
  });
});

describe("confirmRosterSchema", () => {
  it("accepts a roster id and a version", () => {
    expect(confirmRosterSchema.safeParse({ rosterId: REQUEST, version: "v" }).success).toBe(true);
  });

  it("refuses a non-uuid roster id and an empty version", () => {
    expect(confirmRosterSchema.safeParse({ rosterId: "x", version: "v" }).success).toBe(false);
    expect(confirmRosterSchema.safeParse({ rosterId: REQUEST, version: "" }).success).toBe(false);
  });
});

describe("parseRosterFilters", () => {
  it("gives the defaults for an empty query", () => {
    expect(parseRosterFilters({})).toEqual({
      status: "all",
      type: "all",
      siteId: null,
      locationId: null,
      query: "",
    });
  });

  it("keeps a known roster status and falls back to all for anything else", () => {
    for (const status of ["draft", "confirmed", "not-generated"]) {
      expect(parseRosterFilters({ status }).status).toBe(status);
    }
    expect(parseRosterFilters({ status: "other" }).status).toBe("all");
  });

  it("keeps a known type and falls back to all for anything else", () => {
    expect(parseRosterFilters({ type: "weekly" }).type).toBe("weekly");
    expect(parseRosterFilters({ type: "x" }).type).toBe("all");
  });

  it("keeps a uuid for site and location and gives null for anything else", () => {
    const parsed = parseRosterFilters({ site: SHIFT_1, location: "nope" });

    expect(parsed.siteId).toBe(SHIFT_1);
    expect(parsed.locationId).toBeNull();
  });

  it("uses the first element of an array value", () => {
    expect(parseRosterFilters({ status: ["draft", "confirmed"] }).status).toBe("draft");
  });

  it("trims the query and cuts it to 100 characters", () => {
    expect(parseRosterFilters({ q: "  PO-NSL  " }).query).toBe("PO-NSL");
    expect(parseRosterFilters({ q: "a".repeat(150) }).query).toHaveLength(100);
  });
});
