import type {
  ImportCell,
  ImportColumn,
  ImportLookups,
  ImportRawRow,
  ImportRowResult,
  ImportSummary,
} from "@/types/worker-import";
import type { WorkDays } from "@/types/settings";
import type { WorkerAccess } from "@/types/workers";
import { isCalendarDate } from "@/validation/calendar-date";
import { workerSchema } from "@/validation/worker";
import { canWriteWorker } from "./worker-access";
import {
  DUPLICATE_EMPLOYEE_ID_MESSAGE,
  LOCATION_NOT_FOUND_MESSAGE,
  SITE_NOT_FOUND_MESSAGE,
} from "./worker-rules";

function lower(value: string) {
  return value.toLowerCase();
}

// Number cells are read as text, so an ID typed as 12345 still matches. Boolean and date cells never
// mean anything in these columns.
function cellText(column: ImportColumn, cell: ImportCell): { text: string; error: string | null } {
  if (cell === null) {
    return { text: "", error: null };
  }

  if (typeof cell === "string") {
    return { text: cell.trim(), error: null };
  }

  if (typeof cell === "number") {
    return { text: String(cell), error: null };
  }

  return { text: "", error: `${column} must be text` };
}

const END_CONTRACT_REQUIRED_MESSAGE = "End of contract is required";

const END_CONTRACT_FORMAT_MESSAGE = "end_contract must be a date like 2026-12-31";

// read-excel-file gives a date cell as midnight UTC of the day typed in Excel, so the UTC parts hold
// that day in every server time zone. Text must already be YYYY-MM-DD; numbers and booleans are not dates.
function readEndContract(cell: ImportCell): { text: string; error: string | null } {
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) {
      return { text: "", error: END_CONTRACT_FORMAT_MESSAGE };
    }

    return { text: cell.toISOString().slice(0, 10), error: null };
  }

  if (cell === null || (typeof cell === "string" && cell.trim() === "")) {
    return { text: "", error: END_CONTRACT_REQUIRED_MESSAGE };
  }

  const text = typeof cell === "string" ? cell.trim() : String(cell);

  if (typeof cell !== "string" || !isCalendarDate(text)) {
    return { text, error: END_CONTRACT_FORMAT_MESSAGE };
  }

  return { text, error: null };
}

const WORK_DAYS_MESSAGE = "work_days must be 5 or 7";

// Empty means "do not touch", not "clear", so the import never wipes an override. Only the number 5 or 7,
// or text that trims to exactly "5" or "7", is accepted. This does not go through workerSchema,
// which has no way to say "leave the override alone".
function readWorkDays(cell: ImportCell): { value: WorkDays | null; error: string | null } {
  if (cell === null || (typeof cell === "string" && cell.trim() === "")) {
    return { value: null, error: null };
  }

  const value = typeof cell === "string" ? cell.trim() : cell;

  if (value === 5 || value === "5") {
    return { value: 5, error: null };
  }

  if (value === 7 || value === "7") {
    return { value: 7, error: null };
  }

  return { value: null, error: WORK_DAYS_MESSAGE };
}

// Split on commas, trim, and drop blanks and repeats. The first spelling of a name is kept.
function splitPositionNames(text: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const part of text.split(",")) {
    const name = part.trim();

    if (name && !seen.has(lower(name))) {
      seen.add(lower(name));
      names.push(name);
    }
  }

  return names;
}

// Resolves every row against what the actor may write to. It does no I/O, so the same input always
// gives the same result. Lookups are already limited to the actor's scope, and canWriteWorker checks it
// again as a second guard.
export function resolveImportRows(
  rows: ImportRawRow[],
  lookups: ImportLookups,
  access: WorkerAccess,
): ImportRowResult[] {
  const siteByName = new Map(lookups.sites.map((site) => [lower(site.name), site]));
  const locationByName = new Map(
    lookups.locations.map((location) => [`${location.siteId}:${lower(location.name)}`, location]),
  );
  const positionByName = new Map(
    lookups.positions.map((position) => [`${position.siteId}:${lower(position.name)}`, position]),
  );
  const existingById = new Map(lookups.existing.map((worker) => [lower(worker.employeeId), worker]));
  const firstRowOfId = new Map<string, number>();

  return rows.map(({ rowNumber, cells }): ImportRowResult => {
    const errors: string[] = [];

    function read(column: ImportColumn) {
      const { text, error } = cellText(column, cells[column]);

      if (error) {
        errors.push(error);
      }

      return { text, typeError: error !== null };
    }

    const employeeId = read("employee_id");
    const name = read("name");
    const siteCell = read("site");
    const locationCell = read("location");
    const positionsCell = read("positions");

    if (!employeeId.typeError) {
      const parsed = workerSchema.shape.employeeId.safeParse(employeeId.text);

      if (!parsed.success) {
        errors.push(parsed.error.issues[0].message);
      }
    }

    if (!name.typeError) {
      const parsed = workerSchema.shape.name.safeParse(name.text);

      if (!parsed.success) {
        errors.push(parsed.error.issues[0].message);
      }
    }

    const endContract = readEndContract(cells.end_contract);

    if (endContract.error) {
      errors.push(endContract.error);
    }

    const workDays = readWorkDays(cells.work_days);

    if (workDays.error) {
      errors.push(workDays.error);
    }

    const positionNames = splitPositionNames(positionsCell.text);

    const base = {
      rowNumber,
      employeeId: employeeId.text,
      name: name.text,
      siteName: siteCell.text,
      locationName: locationCell.text,
      positionNames,
      endContract: endContract.text,
      workDays: workDays.value,
    };

    if (!siteCell.typeError && siteCell.text === "") {
      errors.push("Site is required");
    }

    if (!locationCell.typeError && locationCell.text === "") {
      errors.push("Location is required");
    }

    const site = siteCell.text ? siteByName.get(lower(siteCell.text)) : undefined;

    if (siteCell.text && !site) {
      errors.push(SITE_NOT_FOUND_MESSAGE);
    }

    const location =
      site && locationCell.text
        ? locationByName.get(`${site.id}:${lower(locationCell.text)}`)
        : undefined;

    if (site && locationCell.text && !location) {
      errors.push(LOCATION_NOT_FOUND_MESSAGE);
    }

    const positions = site
      ? positionNames.map((positionName) => positionByName.get(`${site.id}:${lower(positionName)}`))
      : [];

    if (site) {
      const missing = positionNames.filter((_, index) => !positions[index]);

      if (missing.length > 0) {
        errors.push(`Positions not available in this site: ${missing.join(", ")}`);
      }
    }

    if (site && location && !canWriteWorker(access, { siteId: site.id, locationId: location.id })) {
      errors.push(SITE_NOT_FOUND_MESSAGE);
    }

    const idKey = lower(employeeId.text);

    if (idKey) {
      const firstRow = firstRowOfId.get(idKey);

      if (firstRow === undefined) {
        firstRowOfId.set(idKey, rowNumber);
      } else {
        errors.push(`Employee ID is repeated in the file (first in row ${firstRow})`);
      }
    }

    const existing = idKey ? existingById.get(idKey) : undefined;

    if (existing && !canWriteWorker(access, existing)) {
      errors.push(DUPLICATE_EMPLOYEE_ID_MESSAGE);
    }

    if (errors.length > 0 || !site || !location) {
      return { ...base, action: "error", errors };
    }

    return {
      ...base,
      action: existing ? "update" : "create",
      errors: [],
      workerId: existing?.id ?? null,
      siteId: site.id,
      locationId: location.id,
      positionIds: positions.flatMap((position) => (position ? [position.id] : [])),
    };
  });
}

// The employee IDs in the file, read like the resolver reads them, so the loader looks up the same text.
export function importEmployeeIds(rows: ImportRawRow[]): string[] {
  return rows.flatMap(({ cells }) => {
    const { text, error } = cellText("employee_id", cells.employee_id);

    return text && !error ? [text] : [];
  });
}

export function summarizeImport(rows: ImportRowResult[]): ImportSummary {
  const summary: ImportSummary = { create: 0, update: 0, error: 0 };

  for (const row of rows) {
    summary[row.action] += 1;
  }

  return summary;
}

// The preview text for the Working days column. A blank cell clears nothing: a created worker
// inherits the work rules and an updated one keeps its own override. An error row may be blank or
// invalid, so it claims neither.
export function importWorkDaysText(row: Pick<ImportRowResult, "action" | "workDays">): string {
  if (row.workDays !== null) {
    return `${row.workDays}`;
  }

  if (row.action === "create") {
    return "Inherited";
  }

  return row.action === "update" ? "Unchanged" : "-";
}
