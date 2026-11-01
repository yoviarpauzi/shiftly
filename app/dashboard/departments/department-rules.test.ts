import { describe, expect, it } from "vitest";
import type { DepartmentRow } from "@/types/departments";
import {
  DEPARTMENT_DELETED_MESSAGE,
  LOCATION_DELETED_MESSAGE,
  bulkDeleteMessage,
  bulkRestoreMessage,
  bulkSelectionMode,
  canDeleteDepartment,
  canRestoreDepartment,
  canRestoreSubDepartment,
  isDepartmentNameConflict,
  isSubDepartmentNameConflict,
  nameFieldError,
} from "./department-rules";

const DEPARTMENT_INDEX = "department_locationId_lowerName_active_unique";
const SUB_DEPARTMENT_INDEX = "sub_department_departmentId_lowerName_active_unique";

const department = (deleted: boolean): DepartmentRow => ({
  id: crypto.randomUUID(),
  name: "Production",
  locationId: crypto.randomUUID(),
  locationName: "Kejayan",
  subDepartmentCount: 0,
  deletedAt: deleted ? new Date() : null,
});

describe("canDeleteDepartment", () => {
  it("allows deleting a department with no active sub-departments", () => {
    expect(canDeleteDepartment({ activeSubDepartments: 0 })).toEqual({ ok: true });
  });

  it("blocks deleting a department with one active sub-department", () => {
    expect(canDeleteDepartment({ activeSubDepartments: 1 })).toEqual({
      ok: false,
      formError: "This department has 1 active sub-department. Delete it first.",
    });
  });

  it("uses the plural when several sub-departments are active", () => {
    expect(canDeleteDepartment({ activeSubDepartments: 2 })).toEqual({
      ok: false,
      formError: "This department has 2 active sub-departments. Delete them first.",
    });
  });
});

describe("canRestoreDepartment", () => {
  it("blocks restoring a department whose location is deleted", () => {
    expect(canRestoreDepartment({ locationDeleted: true })).toEqual({
      ok: false,
      formError: LOCATION_DELETED_MESSAGE,
    });
    expect(LOCATION_DELETED_MESSAGE).toBe("Restore the location first");
  });

  it("allows restoring a department whose location is active", () => {
    expect(canRestoreDepartment({ locationDeleted: false })).toEqual({ ok: true });
  });
});

describe("canRestoreSubDepartment", () => {
  it("blocks restoring a sub-department whose department is deleted", () => {
    expect(canRestoreSubDepartment({ departmentDeleted: true })).toEqual({
      ok: false,
      formError: DEPARTMENT_DELETED_MESSAGE,
    });
    expect(DEPARTMENT_DELETED_MESSAGE).toBe("Restore the department first");
  });

  it("allows restoring a sub-department whose department is active", () => {
    expect(canRestoreSubDepartment({ departmentDeleted: false })).toEqual({ ok: true });
  });
});

describe("isDepartmentNameConflict", () => {
  const conflict = { code: "23505", constraint: DEPARTMENT_INDEX };

  it("recognizes the unique index violation, which also covers names that differ only in case", () => {
    expect(isDepartmentNameConflict(conflict)).toBe(true);
  });

  it("recognizes the violation wrapped on cause", () => {
    expect(isDepartmentNameConflict(new Error("query failed", { cause: conflict }))).toBe(true);
    expect(isDepartmentNameConflict({ cause: conflict })).toBe(true);
  });

  it("rejects a different constraint", () => {
    expect(
      isDepartmentNameConflict({ code: "23505", constraint: SUB_DEPARTMENT_INDEX }),
    ).toBe(false);
    expect(isDepartmentNameConflict({ code: "23505", constraint: "other_unique" })).toBe(false);
  });

  it("rejects a different error code", () => {
    expect(isDepartmentNameConflict({ code: "23503", constraint: DEPARTMENT_INDEX })).toBe(false);
    expect(isDepartmentNameConflict({ cause: { code: "23503", constraint: DEPARTMENT_INDEX } })).toBe(
      false,
    );
  });

  it("rejects null and strings", () => {
    expect(isDepartmentNameConflict(null)).toBe(false);
    expect(isDepartmentNameConflict("23505")).toBe(false);
  });
});

describe("isSubDepartmentNameConflict", () => {
  const conflict = { code: "23505", constraint: SUB_DEPARTMENT_INDEX };

  it("recognizes the unique index violation, which also covers names that differ only in case", () => {
    expect(isSubDepartmentNameConflict(conflict)).toBe(true);
  });

  it("recognizes the violation wrapped on cause", () => {
    expect(isSubDepartmentNameConflict(new Error("query failed", { cause: conflict }))).toBe(true);
    expect(isSubDepartmentNameConflict({ cause: conflict })).toBe(true);
  });

  it("rejects the department index and other constraints", () => {
    expect(
      isSubDepartmentNameConflict({ code: "23505", constraint: DEPARTMENT_INDEX }),
    ).toBe(false);
    expect(isSubDepartmentNameConflict({ code: "23505", constraint: "other_unique" })).toBe(false);
  });

  it("rejects a different error code", () => {
    expect(
      isSubDepartmentNameConflict({ code: "23503", constraint: SUB_DEPARTMENT_INDEX }),
    ).toBe(false);
  });

  it("rejects null and strings", () => {
    expect(isSubDepartmentNameConflict(null)).toBe(false);
    expect(isSubDepartmentNameConflict("23505")).toBe(false);
  });
});

describe("nameFieldError", () => {
  it("wraps a message so the form can show it", () => {
    expect(nameFieldError("Name is already used in this location")).toEqual({
      message: "Name is already used in this location",
    });
  });

  it("returns undefined when there is no message", () => {
    expect(nameFieldError(undefined)).toBeUndefined();
    expect(nameFieldError("")).toBeUndefined();
  });
});

describe("bulkDeleteMessage", () => {
  it("reports every department deleted", () => {
    expect(bulkDeleteMessage(2, 0)).toBe("2 departments deleted");
    expect(bulkDeleteMessage(1, 0)).toBe("1 department deleted");
  });

  it("reports a partial result", () => {
    expect(bulkDeleteMessage(1, 1)).toBe("1 department deleted, 1 could not be deleted");
  });

  it("reports when none could be deleted", () => {
    expect(bulkDeleteMessage(0, 2)).toBe("2 departments could not be deleted");
  });
});

describe("bulkRestoreMessage", () => {
  it("reports every department restored", () => {
    expect(bulkRestoreMessage(2, 0)).toBe("2 departments restored");
  });

  it("reports a partial result", () => {
    expect(bulkRestoreMessage(1, 2)).toBe("1 department restored, 2 could not be restored");
  });

  it("reports when none could be restored", () => {
    expect(bulkRestoreMessage(0, 2)).toBe("2 departments could not be restored");
  });
});

describe("bulkSelectionMode", () => {
  it("is none when nothing is selected", () => {
    expect(bulkSelectionMode([])).toBe("none");
  });

  it("is active when every row is active", () => {
    expect(bulkSelectionMode([department(false), department(false)])).toBe("active");
  });

  it("is deleted when every row is deleted", () => {
    expect(bulkSelectionMode([department(true), department(true)])).toBe("deleted");
  });

  it("is mixed when active and deleted rows are selected together", () => {
    expect(bulkSelectionMode([department(false), department(true)])).toBe("mixed");
  });
});
