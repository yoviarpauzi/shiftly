import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { attendance, attendanceSubstitute } from "@/database/schema/attendance-schema";
import type { AttendanceAccess } from "@/types/attendance";

const dialect = new PgDialect();

// The database is replaced by a recorder. Each select takes the next result from `queue`, and each
// where is kept in call order: the location, the shifts, the assignments, then the targets.
const fake = vi.hoisted(() => ({
  queue: [] as unknown[][],
  wheres: [] as unknown[],
  columns: [] as Record<string, unknown>[],
  joins: [] as { kind: "inner" | "left"; table: unknown }[][],
  selects: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    select: (columns: Record<string, unknown>) => {
      fake.selects += 1;
      fake.columns.push(columns);
      const joins: { kind: "inner" | "left"; table: unknown }[] = [];
      fake.joins.push(joins);

      const result = fake.queue.shift() ?? [];
      const chain = {
        from: () => chain,
        innerJoin: (table: unknown) => {
          joins.push({ kind: "inner", table });
          return chain;
        },
        leftJoin: (table: unknown) => {
          joins.push({ kind: "left", table });
          return chain;
        },
        where: (condition: unknown) => {
          fake.wheres.push(condition);
          return chain;
        },
        orderBy: () => chain,
        then: (resolve: (value: unknown[]) => unknown) => resolve(result),
      };

      return chain;
    },
  },
}));

const { loadExportInput } = await import("./attendance-export");

const LOCATION = "33333333-3333-4333-8333-333333333331";
const OTHER_LOCATION = "33333333-3333-4333-8333-333333333332";
const FROM = "2026-11-09";
const TO = "2026-11-15";

const HO: AttendanceAccess = { userId: "u-1", role: "ho", locationId: null };
const ADMIN_OWN: AttendanceAccess = {
  userId: "u-2",
  role: "admin_site",
  locationId: LOCATION,
};
const ADMIN_OTHER: AttendanceAccess = {
  userId: "u-4",
  role: "admin_site",
  locationId: OTHER_LOCATION,
};

const locationRow = { id: LOCATION, name: "Kejayan" };

const assignmentRow = {
  employeeId: "00123",
  workerName: "Budi",
  departmentId: "dA",
  departmentName: "Produksi",
  positionId: "p1",
  positionName: "Operator",
  date: "2026-11-09",
  shiftId: "s1",
  shiftOrder: 1,
  coveredBy: null,
};

const targetRow = {
  departmentId: "dA",
  departmentName: "Produksi",
  positionId: "p1",
  positionName: "Operator",
  date: "2026-11-09",
  shiftId: "s1",
  shiftOrder: 1,
  headcount: 2,
};

beforeEach(() => {
  fake.queue = [];
  fake.wheres = [];
  fake.columns = [];
  fake.joins = [];
  fake.selects = 0;
});

describe("loadExportInput", () => {
  it("gives null and reads nothing more when the location does not exist", async () => {
    fake.queue = [[]];

    expect(await loadExportInput(HO, LOCATION, FROM, TO)).toBeNull();
    expect(fake.selects).toBe(1);
  });

  it("gives null for a location outside the access, without reading any rows", async () => {
    fake.queue = [[locationRow]];
    expect(await loadExportInput(ADMIN_OTHER, LOCATION, FROM, TO)).toBeNull();
    expect(fake.selects).toBe(1);
  });

  it("lets HO and the admin site of the location read it", async () => {
    for (const access of [HO, ADMIN_OWN]) {
      fake.queue = [[locationRow], [], [], []];

      expect(await loadExportInput(access, LOCATION, FROM, TO)).toMatchObject({
        locationName: "Kejayan",
      });
    }
  });

  it("asks only for the location, the week, confirmed rosters, and approved requests", async () => {
    fake.queue = [[locationRow], [], [], []];

    await loadExportInput(HO, LOCATION, FROM, TO);

    const assignments = dialect.sqlToQuery(fake.wheres[2] as SQL).params;
    const targets = dialect.sqlToQuery(fake.wheres[3] as SQL).params;

    expect(assignments).toEqual(
      expect.arrayContaining([LOCATION, FROM, TO, "confirmed", "approved", "work"]),
    );
    expect(targets).toEqual(expect.arrayContaining([LOCATION, FROM, TO, "confirmed", "approved"]));
  });

  it("reads the replacement's name only for an Absent row, through the attendance row", async () => {
    fake.queue = [[locationRow], [], [], []];

    await loadExportInput(HO, LOCATION, FROM, TO);

    const joins = fake.joins[2];
    const [attendanceJoin, substituteJoin, replacementJoin] = joins.slice(-3);

    // The attendance row, its replacement and the replacement's worker are all optional, so a
    // row with no mark or no replacement still prints.
    expect(attendanceJoin).toEqual({ kind: "left", table: attendance });
    expect(substituteJoin).toEqual({ kind: "left", table: attendanceSubstitute });
    expect(replacementJoin.kind).toBe("left");

    const covered = dialect.sqlToQuery(fake.columns[2].coveredBy as SQL);

    expect(covered.sql).toContain('"attendance"."status" = $1');
    expect(covered.sql).toMatch(/^case when .* then "[a-z_]+"\."name" end$/);
    expect(covered.params).toEqual(["absent"]);
    // The location, the shifts and the targets do not read it.
    expect(fake.columns[3]).not.toHaveProperty("coveredBy");
  });

  it("keeps a worker, department, or shift that was deleted after the day", async () => {
    fake.queue = [[locationRow], [], [], []];

    await loadExportInput(HO, LOCATION, FROM, TO);

    for (const where of [fake.wheres[2], fake.wheres[3]]) {
      const text = dialect.sqlToQuery(where as SQL).sql;

      expect(text).not.toContain('"department"."deleted_at"');
      expect(text).not.toContain('"shift"."deleted_at"');
      expect(text).not.toContain('"worker"."deleted_at"');
    }
  });

  it("returns the rows with the location name and the week", async () => {
    fake.queue = [[locationRow], [{ id: "s1", order: 1 }], [assignmentRow], [targetRow]];

    const input = await loadExportInput(HO, LOCATION, FROM, TO);

    expect(input).toEqual({
      locationName: "Kejayan",
      from: FROM,
      to: TO,
      shifts: [{ id: "s1", order: 1 }],
      assignments: [assignmentRow],
      targets: [targetRow],
    });
  });

  it("adds a shift deleted after the day once, in order, to the active shifts", async () => {
    fake.queue = [
      [locationRow],
      [
        { id: "s1", order: 1 },
        { id: "s2", order: 2 },
      ],
      [
        { ...assignmentRow, shiftId: "s9", shiftOrder: 3 },
        { ...assignmentRow, employeeId: "00124", shiftId: "s9", shiftOrder: 3 },
        { ...assignmentRow, employeeId: "00125", shiftId: "s1", shiftOrder: 1 },
      ],
      [{ ...targetRow, shiftId: "s9", shiftOrder: 3 }],
    ];

    const input = await loadExportInput(HO, LOCATION, FROM, TO);

    expect(input?.shifts).toEqual([
      { id: "s1", order: 1 },
      { id: "s2", order: 2 },
      { id: "s9", order: 3 },
    ]);
  });
});
