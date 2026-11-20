import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttendanceAccess } from "@/types/attendance";

const dialect = new PgDialect();

// The database is replaced by a recorder. Each select takes the next result from `queue`, and each
// where is kept in call order: the location, the shifts, the assignments, then the targets.
const fake = vi.hoisted(() => ({
  queue: [] as unknown[][],
  wheres: [] as unknown[],
  selects: 0,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => {
      fake.selects += 1;

      const result = fake.queue.shift() ?? [];
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        leftJoin: () => chain,
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
