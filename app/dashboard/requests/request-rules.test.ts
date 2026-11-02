import { describe, expect, it } from "vitest";
import {
  canCancelRequest,
  canDecideStatus,
  formatRequestDates,
  initialStatus,
  lineScopeError,
  requestFieldErrors,
  statusAfterEdit,
} from "./request-rules";
import type { RequestStatus } from "@/types/requests";

const DEPT_A = "dept-a";
const DEPT_B = "dept-b";
const SUB_A = "sub-a";
const SUB_B = "sub-b";
const POSITION = "position-1";

const valid = {
  departments: new Map([
    [DEPT_A, new Set([SUB_A])],
    [DEPT_B, new Set([SUB_B])],
  ]),
  positionIds: new Set([POSITION]),
};

const line = (fields: {
  departmentId?: string;
  subDepartmentId?: string | null;
  positionId?: string;
}) => ({
  departmentId: DEPT_A,
  subDepartmentId: null,
  positionId: POSITION,
  headcount: 2,
  ...fields,
});

describe("initialStatus", () => {
  it("approves a daily request on save", () => {
    expect(initialStatus("daily")).toBe("approved");
  });

  it("holds a weekly request for approval", () => {
    expect(initialStatus("weekly")).toBe("pending");
  });
});

describe("statusAfterEdit", () => {
  it("sends an approved weekly request back to pending", () => {
    expect(statusAfterEdit("weekly", "approved")).toBe("pending");
  });

  it("keeps an approved daily request approved", () => {
    expect(statusAfterEdit("daily", "approved")).toBe("approved");
  });

  it("keeps a pending request pending", () => {
    expect(statusAfterEdit("weekly", "pending")).toBe("pending");
    expect(statusAfterEdit("daily", "pending")).toBe("pending");
  });

  it("does not allow editing a rejected or cancelled request", () => {
    expect(statusAfterEdit("weekly", "rejected")).toBeNull();
    expect(statusAfterEdit("daily", "rejected")).toBeNull();
    expect(statusAfterEdit("weekly", "cancelled")).toBeNull();
    expect(statusAfterEdit("daily", "cancelled")).toBeNull();
  });
});

describe("canCancelRequest", () => {
  it.each<[RequestStatus, boolean]>([
    ["pending", true],
    ["approved", true],
    ["rejected", false],
    ["cancelled", false],
  ])("%s gives %s", (status, expected) => {
    expect(canCancelRequest(status)).toBe(expected);
  });
});

describe("canDecideStatus", () => {
  it.each<[RequestStatus, boolean]>([
    ["pending", true],
    ["approved", false],
    ["rejected", false],
    ["cancelled", false],
  ])("%s gives %s", (status, expected) => {
    expect(canDecideStatus(status)).toBe(expected);
  });
});

describe("formatRequestDates", () => {
  it("shows one date for a daily request", () => {
    expect(formatRequestDates("daily", "2026-11-03")).toBe("2026-11-03");
  });

  it("shows a 7 day range for a weekly request", () => {
    expect(formatRequestDates("weekly", "2026-11-03")).toBe("2026-11-03 - 2026-11-09");
  });

  it("crosses a month end", () => {
    expect(formatRequestDates("weekly", "2026-11-27")).toBe("2026-11-27 - 2026-12-03");
  });

  it("crosses a year end", () => {
    expect(formatRequestDates("weekly", "2026-12-29")).toBe("2026-12-29 - 2027-01-04");
  });

  it("handles a leap day", () => {
    expect(formatRequestDates("weekly", "2028-02-26")).toBe("2028-02-26 - 2028-03-03");
  });
});

describe("lineScopeError", () => {
  it("returns null for a valid set", () => {
    expect(
      lineScopeError(
        [line({}), line({ departmentId: DEPT_B, subDepartmentId: SUB_B })],
        valid,
      ),
    ).toBeNull();
  });

  it("rejects an unknown department", () => {
    expect(lineScopeError([line({ departmentId: "missing" })], valid)).toEqual(
      expect.any(String),
    );
  });

  it("rejects a sub-department of another department", () => {
    expect(lineScopeError([line({ subDepartmentId: SUB_B })], valid)).toEqual(
      expect.any(String),
    );
  });

  it("rejects an unknown position", () => {
    expect(lineScopeError([line({ positionId: "missing" })], valid)).toEqual(
      expect.any(String),
    );
  });

  it("uses a different message for each failure", () => {
    const messages = [
      lineScopeError([line({ departmentId: "missing" })], valid),
      lineScopeError([line({ subDepartmentId: SUB_B })], valid),
      lineScopeError([line({ positionId: "missing" })], valid),
    ];

    expect(new Set(messages).size).toBe(3);
  });
});

describe("requestFieldErrors", () => {
  it("keeps the first message for each field", () => {
    expect(
      requestFieldErrors([
        { path: ["startDate"], message: "first" },
        { path: ["startDate"], message: "second" },
        { path: ["lines", 0, "headcount"], message: "lines message" },
      ]),
    ).toEqual({ startDate: "first", lines: "lines message" });
  });
});
