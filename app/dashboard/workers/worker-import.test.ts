import { describe, expect, it } from "vitest";
import type { ImportCell, ImportCellColumn, ImportLookups, ImportRawRow } from "@/types/worker-import";
import type { WorkerAccess } from "@/types/workers";
import {
  importEmployeeIds,
  importWorkDaysText,
  resolveImportRows,
  summarizeImport,
} from "./worker-import";

const EVERYWHERE: WorkerAccess = { siteId: null, locationId: null };

const lookups: ImportLookups = {
  sites: [
    { id: "s1", name: "Alpha" },
    { id: "s2", name: "Beta" },
  ],
  locations: [
    { id: "l1", siteId: "s1", name: "Gudang" },
    { id: "l2", siteId: "s1", name: "Kantor" },
    { id: "l3", siteId: "s2", name: "Pabrik" },
  ],
  positions: [
    { id: "p1", siteId: "s1", name: "Operator" },
    { id: "p2", siteId: "s1", name: "Driver" },
    { id: "p3", siteId: "s2", name: "Operator" },
  ],
  existing: [],
};

const existingWorker = { id: "w1", employeeId: "EMP-1", siteId: "s1", locationId: "l1" };

function row(
  rowNumber: number,
  cells: Partial<Record<ImportCellColumn, ImportCell>> = {},
): ImportRawRow {
  return {
    rowNumber,
    cells: {
      employee_id: "EMP-1",
      name: "Budi",
      site: "Alpha",
      location: "Gudang",
      positions: "",
      end_contract: "2026-12-31",
      work_days: null,
      ...cells,
    },
  };
}

function resolveOne(
  cells: Partial<Record<ImportCellColumn, ImportCell>>,
  options: { lookups?: ImportLookups; access?: WorkerAccess } = {},
) {
  return resolveImportRows([row(2, cells)], options.lookups ?? lookups, options.access ?? EVERYWHERE)[0];
}

describe("resolveImportRows", () => {
  it("resolves a valid row as a create", () => {
    const result = resolveOne({ positions: "Operator, Driver" });

    expect(result).toMatchObject({
      action: "create",
      workerId: null,
      siteId: "s1",
      locationId: "l1",
      positionIds: ["p1", "p2"],
      errors: [],
    });
  });

  it("matches names ignoring case and padding", () => {
    const result = resolveOne({ site: " alpha ", location: "GUDANG", positions: "operator" });

    expect(result).toMatchObject({
      action: "create",
      siteId: "s1",
      locationId: "l1",
      positionIds: ["p1"],
    });
  });

  it("resolves an existing employee ID in scope as an update", () => {
    const result = resolveOne(
      { employee_id: "emp-1" },
      { lookups: { ...lookups, existing: [existingWorker] } },
    );

    expect(result).toMatchObject({ action: "update", workerId: "w1" });
  });

  it("gives the same result when the same file is imported again", () => {
    const withExisting = { ...lookups, existing: [existingWorker] };
    const rows = [row(2, { positions: "Operator" }), row(3, { employee_id: "EMP-2", name: "Sari" })];

    const first = resolveImportRows(rows, withExisting, EVERYWHERE);
    const second = resolveImportRows(rows, withExisting, EVERYWHERE);

    expect(second).toEqual(first);
    expect(first.map((item) => item.action)).toEqual(["update", "create"]);
    expect(first.flatMap((item) => item.errors)).toEqual([]);
  });

  it("rejects an employee ID that belongs to a worker out of scope", () => {
    const result = resolveOne(
      { site: "Beta", location: "Pabrik" },
      {
        access: { siteId: "s2", locationId: null },
        lookups: { ...lookups, existing: [existingWorker] },
      },
    );

    expect(result).toMatchObject({
      action: "error",
      errors: ["Employee ID is already used by another worker"],
    });
  });

  it("flags an employee ID that repeats in the file, ignoring case", () => {
    const [first, second] = resolveImportRows(
      [row(2), row(3, { employee_id: "emp-1" })],
      lookups,
      EVERYWHERE,
    );

    expect(first.action).toBe("create");
    expect(second).toMatchObject({ action: "error" });
    expect(second.errors[0]).toContain("first in row 2");
  });

  it("treats an employee ID as new when only a deleted worker has it", () => {
    // The loader leaves soft-deleted workers out of existing, as the unique index does.
    expect(resolveOne({}).action).toBe("create");
  });

  it("gives an out-of-scope site the same message as an unknown site", () => {
    const limited = { ...lookups, sites: [{ id: "s2", name: "Beta" }] };
    const outOfScope = resolveOne({ site: "Alpha" }, { lookups: limited });
    const unknown = resolveOne({ site: "Nowhere" }, { lookups: limited });

    expect(outOfScope.errors).toEqual(["Site not found"]);
    expect(unknown.errors).toEqual(outOfScope.errors);
  });

  it("rejects a location outside the list an admin site may use", () => {
    const limited = { ...lookups, locations: [{ id: "l1", siteId: "s1", name: "Gudang" }] };
    const result = resolveOne(
      { location: "Kantor" },
      { lookups: limited, access: { siteId: "s1", locationId: "l1" } },
    );

    expect(result.errors).toEqual(["Location not found in this site"]);
  });

  it("stops an admin site at the write guard when a lookup leaks another location", () => {
    const result = resolveOne(
      { location: "Kantor" },
      { access: { siteId: "s1", locationId: "l1" } },
    );

    expect(result.action).toBe("error");
    expect(result.errors).toContain("Site not found");
  });

  it("does not let HO move a worker to another site", () => {
    const result = resolveOne(
      { site: "Beta", location: "Pabrik" },
      {
        access: { siteId: "s1", locationId: null },
        lookups: {
          ...lookups,
          sites: [{ id: "s1", name: "Alpha" }],
          existing: [existingWorker],
        },
      },
    );

    expect(result.errors).toEqual(["Site not found"]);
  });

  it("rejects a location that belongs to another site", () => {
    const result = resolveOne({ site: "Alpha", location: "Pabrik" });

    expect(result.errors).toEqual(["Location not found in this site"]);
  });

  it("dedupes positions and ignores blanks, keeping the first spelling", () => {
    const result = resolveOne({ positions: "Operator, operator,, Driver ," });

    expect(result).toMatchObject({
      positionIds: ["p1", "p2"],
      positionNames: ["Operator", "Driver"],
    });
  });

  it("allows an empty positions cell", () => {
    const result = resolveOne({ positions: "" });

    expect(result).toMatchObject({ action: "create", positionIds: [] });
  });

  it("names the positions that are not available", () => {
    const result = resolveOne({ positions: "Operator, Ghost, Spare" });

    expect(result.errors).toEqual(["Positions not available in this site: Ghost, Spare"]);
  });

  it("looks positions up inside the row's site", () => {
    const result = resolveOne({ positions: "Operator" });

    expect(result).toMatchObject({ positionIds: ["p1"] });
  });

  it("collects every error of a row", () => {
    const result = resolveOne({ employee_id: "", name: "", site: "Nowhere" });

    expect(result.errors).toEqual([
      "Employee ID is required",
      "Name is required",
      "Site not found",
    ]);
  });

  it("turns numeric cells into text", () => {
    expect(resolveOne({ employee_id: 12345 }).employeeId).toBe("12345");
  });

  it("rejects boolean and date cells in text columns", () => {
    expect(resolveOne({ name: true }).errors).toEqual(["name must be text"]);
    expect(resolveOne({ employee_id: new Date(0) }).errors).toEqual(["employee_id must be text"]);
  });

  it("rejects a name over 100 characters", () => {
    expect(resolveOne({ name: "x".repeat(101) }).errors).toEqual([
      "Name must be 100 characters or fewer",
    ]);
  });

  it("reads a text end of contract, trimmed", () => {
    expect(resolveOne({ end_contract: "2026-12-31" })).toMatchObject({
      action: "create",
      endContract: "2026-12-31",
      errors: [],
    });
    expect(resolveOne({ end_contract: " 2026-12-31 " })).toMatchObject({
      action: "create",
      endContract: "2026-12-31",
      errors: [],
    });
  });

  it("reads a date cell as the day typed in Excel", () => {
    // read-excel-file gives a date cell as midnight UTC of the typed day.
    const result = resolveOne({ end_contract: new Date(Date.UTC(2026, 11, 31)) });

    expect(result).toMatchObject({ action: "create", endContract: "2026-12-31", errors: [] });
  });

  it("reads a late-evening UTC date cell by its UTC day, not the local day", () => {
    // 23:00 UTC on 31 December is already 1 January at UTC+7, so local day parts would give 2027-01-01.
    const result = resolveOne({ end_contract: new Date(Date.UTC(2026, 11, 31, 23, 0)) });

    expect(result.endContract).toBe("2026-12-31");
  });

  it("requires an end of contract, without hiding other errors", () => {
    expect(resolveOne({ end_contract: null }).errors).toEqual(["End of contract is required"]);
    expect(resolveOne({ end_contract: "   " }).errors).toEqual(["End of contract is required"]);
    expect(resolveOne({ end_contract: null, name: "" }).errors).toEqual([
      "Name is required",
      "End of contract is required",
    ]);
  });

  it.each<[string, ImportCell]>([
    ["a number", 45000],
    ["a boolean", true],
    ["text in another format", "11/02/2026"],
    ["a day that does not exist", "2026-02-30"],
  ])("rejects %s as the end of contract, and still checks the other columns", (_, cell) => {
    const message = "end_contract must be a date like 2026-12-31";

    expect(resolveOne({ end_contract: cell }).errors).toEqual([message]);
    expect(resolveOne({ end_contract: cell, name: "", site: "Nowhere" })).toMatchObject({
      action: "error",
      errors: ["Name is required", message, "Site not found"],
    });
  });

  it("keeps the end of contract as read when it is not a date", () => {
    expect(resolveOne({ end_contract: "11/02/2026" }).endContract).toBe("11/02/2026");
    expect(resolveOne({ end_contract: 45000 }).endContract).toBe("45000");
    expect(resolveOne({ end_contract: null }).endContract).toBe("");
  });

  it("carries the end of contract on an update and a create", () => {
    const [update, create] = resolveImportRows(
      [
        row(2, { end_contract: "2027-03-31" }),
        row(3, { employee_id: "EMP-2", end_contract: "2027-06-30" }),
      ],
      { ...lookups, existing: [existingWorker] },
      EVERYWHERE,
    );

    expect(update).toMatchObject({ action: "update", workerId: "w1", endContract: "2027-03-31" });
    expect(create).toMatchObject({ action: "create", workerId: null, endContract: "2027-06-30" });
  });

  it("keeps the input order and is deterministic", () => {
    const rows = [row(5, { employee_id: "A" }), row(3, { employee_id: "B" }), row(9, { employee_id: "C" })];

    const first = resolveImportRows(rows, lookups, EVERYWHERE);

    expect(first.map((item) => item.rowNumber)).toEqual([5, 3, 9]);
    expect(resolveImportRows(rows, lookups, EVERYWHERE)).toEqual(first);
  });
});

describe("summarizeImport", () => {
  it("counts creates, updates, and errors", () => {
    const rows = resolveImportRows(
      [row(2), row(3, { employee_id: "EMP-2", site: "Nowhere" }), row(4, { employee_id: "EMP-1" })],
      { ...lookups, existing: [existingWorker] },
      EVERYWHERE,
    );

    // Row 2 and row 4 share EMP-1, so row 4 repeats the ID and is an error.
    expect(summarizeImport(rows)).toEqual({ create: 0, update: 1, error: 2 });
  });
});

describe("importEmployeeIds", () => {
  it("lists the trimmed employee IDs the loader should look up", () => {
    const rows = [
      row(2, { employee_id: " A " }),
      row(3, { employee_id: 12 }),
      row(4, { employee_id: true }),
      row(5, { employee_id: "" }),
      row(6, { employee_id: null }),
    ];

    expect(importEmployeeIds(rows)).toEqual(["A", "12"]);
  });
});

describe("work_days", () => {
  it.each([
    [5, 5],
    ["5", 5],
    [7, 7],
    [" 7 ", 7],
    [null, null],
    ["", null],
    ["  ", null],
  ] as [ImportCell, 5 | 7 | null][])("reads %j as %j", (cell, expected) => {
    expect(resolveOne({ work_days: cell })).toMatchObject({ action: "create", workDays: expected, errors: [] });
  });

  it.each([6, 5.5, "five", true, 0, "6", "5.0", new Date(Date.UTC(2026, 0, 1))] as ImportCell[])(
    "rejects %j as a row error",
    (cell) => {
      expect(resolveOne({ work_days: cell })).toMatchObject({
        action: "error",
        errors: ["work_days must be 5 or 7"],
      });
    },
  );

  it("keeps a blank work_days on an update row as null, so the override is kept", () => {
    const result = resolveOne(
      { work_days: null },
      { lookups: { ...lookups, existing: [existingWorker] } },
    );

    expect(result).toMatchObject({ action: "update", workDays: null });
  });

  it("reports the work_days error next to the other row errors", () => {
    expect(resolveOne({ work_days: 6, site: "Nowhere" })).toMatchObject({
      action: "error",
      errors: ["work_days must be 5 or 7", "Site not found"],
    });
  });
});

describe("importWorkDaysText", () => {
  it.each([
    ["create", 5, "5"],
    ["update", 7, "7"],
    ["create", null, "Inherited"],
    ["update", null, "Unchanged"],
    ["error", null, "-"],
  ] as const)("shows a %s row with work days %j as %j", (action, workDays, expected) => {
    expect(importWorkDaysText({ action, workDays })).toBe(expected);
  });
});
