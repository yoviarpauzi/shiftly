import { describe, expect, it } from "vitest";
import {
  bulkWorkerDeleteMessage,
  bulkWorkerRestoreMessage,
  canRestoreWorker,
  isEmployeeIdConflict,
  LOCATION_DELETED_MESSAGE,
  SITE_DELETED_MESSAGE,
} from "./worker-rules";

const conflict = { code: "23505", constraint: "worker_lowerEmployeeId_active_unique" };

describe("canRestoreWorker", () => {
  it("allows a restore when the site and the location are active", () => {
    expect(canRestoreWorker({ siteDeleted: false, locationDeleted: false })).toEqual({ ok: true });
  });

  it("blocks a restore under a deleted site first", () => {
    expect(canRestoreWorker({ siteDeleted: true, locationDeleted: true })).toEqual({
      ok: false,
      formError: SITE_DELETED_MESSAGE,
    });
  });

  it("blocks a restore under a deleted location", () => {
    expect(canRestoreWorker({ siteDeleted: false, locationDeleted: true })).toEqual({
      ok: false,
      formError: LOCATION_DELETED_MESSAGE,
    });
  });
});

describe("isEmployeeIdConflict", () => {
  it("detects the unique index error", () => {
    expect(isEmployeeIdConflict(conflict)).toBe(true);
  });

  it("detects it when Drizzle wraps the error in cause", () => {
    expect(isEmployeeIdConflict(new Error("failed", { cause: conflict }))).toBe(true);
  });

  it("ignores other unique violations and other errors", () => {
    expect(isEmployeeIdConflict({ code: "23505", constraint: "other" })).toBe(false);
    expect(isEmployeeIdConflict(new Error("boom"))).toBe(false);
    expect(isEmployeeIdConflict(null)).toBe(false);
  });
});

describe("bulk worker messages", () => {
  it("reports a clean bulk delete with the right plural", () => {
    expect(bulkWorkerDeleteMessage(1, 0)).toBe("1 worker deleted");
    expect(bulkWorkerDeleteMessage(3, 0)).toBe("3 workers deleted");
  });

  it("reports a bulk delete where every worker was blocked", () => {
    expect(bulkWorkerDeleteMessage(0, 2)).toBe("2 workers could not be deleted");
  });

  it("reports a mixed bulk restore", () => {
    expect(bulkWorkerRestoreMessage(2, 1)).toBe("2 workers restored, 1 could not be restored");
  });
});
