import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { attendanceSubstitute } from "./attendance-schema";

const config = getTableConfig(attendanceSubstitute);

describe("attendance_substitute table", () => {
  it("is named attendance_substitute", () => {
    expect(config.name).toBe("attendance_substitute");
  });

  it("makes attendance_id unique", () => {
    const column = config.columns.find((c) => c.name === "attendance_id");
    expect(column?.isUnique).toBe(true);
    expect(column?.notNull).toBe(true);
  });

  it("has a unique index on substitute worker and date", () => {
    const index = config.indexes.find(
      (i) => i.config.name === "attendance_substitute_worker_date_unique",
    );
    expect(index?.config.unique).toBe(true);
    const names = index?.config.columns.map((c) => ("name" in c ? c.name : null));
    expect(names).toEqual(["substitute_worker_id", "work_date"]);
  });

  it("cascades from attendance and restricts the substitute worker", () => {
    const actions = Object.fromEntries(
      config.foreignKeys.map((fk) => {
        const ref = fk.reference();
        return [ref.columns[0].name, fk.onDelete];
      }),
    );
    expect(actions.attendance_id).toBe("cascade");
    expect(actions.substitute_worker_id).toBe("restrict");
    expect(actions.created_by).toBe("set null");
  });
});
