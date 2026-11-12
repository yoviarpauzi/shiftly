import { addDays } from "@/app/dashboard/rosters/roster-rules";
import type {
  ExportAssignmentRow,
  ExportForm,
  ExportInput,
  ExportModel,
  ExportRequestRow,
  ExportSheet,
  ExportTargetRow,
} from "@/types/attendance-export";

const WEEKDAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const SHEET_PREFIX = "Form Absensi Papan";

// Excel refuses these in a sheet name, and caps a name at 31 characters.
const SHEET_FORBIDDEN = /[[\]:*?/\\]/g;
const SHEET_MAX_LENGTH = 31;

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function dayOfWeek(date: string): number {
  const [year, month, day] = date.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// Monday to Sunday around a date. A Sunday belongs to the week that began the Monday before.
export function weekBounds(date: string): { from: string; to: string } {
  const sinceMonday = (dayOfWeek(date) + 6) % 7;
  const from = addDays(date, -sinceMonday);

  return { from, to: addDays(from, 6) };
}

export function weekdayNameId(date: string): string {
  return WEEKDAYS_ID[dayOfWeek(date)];
}

// "Form Absensi Papan {department}", cleaned for Excel and unique among the names already taken.
// Excel compares sheet names without regard to case, so this does too.
export function exportSheetName(department: string, taken: ReadonlySet<string>): string {
  const used = new Set([...taken].map((name) => name.toLowerCase()));
  const base = `${SHEET_PREFIX} ${department.replace(SHEET_FORBIDDEN, "")}`.trim();

  for (let attempt = 1; ; attempt += 1) {
    const suffix = attempt === 1 ? "" : ` ${attempt}`;
    const name = `${base.slice(0, SHEET_MAX_LENGTH - suffix.length).trimEnd()}${suffix}`;

    if (!used.has(name.toLowerCase())) {
      return name;
    }
  }
}

export function exportFileName(location: string, from: string, to: string): string {
  const slug = location
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `absensi-${slug || "lokasi"}-${from}-${to}.xlsx`;
}

function byWorker(a: ExportAssignmentRow, b: ExportAssignmentRow): number {
  return (
    compare(a.positionName.toLowerCase(), b.positionName.toLowerCase()) ||
    compare(a.workerName.toLowerCase(), b.workerName.toLowerCase()) ||
    compare(a.employeeId.toLowerCase(), b.employeeId.toLowerCase())
  );
}

function sumOrNull(values: number[]): number | null {
  const sum = values.reduce((total, value) => total + value, 0);

  return sum === 0 ? null : sum;
}

// The sheets of the workbook: one per department that has a worker or a request headcount in the
// week. A form (a day and a shift) is written only when it has a worker or a headcount, so no empty
// form is printed. The request table of a form shows the whole day, for every shift column.
export function buildExportModel(input: ExportInput): ExportModel {
  const title = `Absensi Daily Helper ${input.locationName}`;
  const shifts = [...input.shifts].sort((a, b) => a.order - b.order || compare(a.id, b.id));
  const shiftLabels = shifts.map((shift) => `S${shift.order}`);
  const targets = input.targets.filter((row) => row.headcount > 0);

  const departments = new Map<string, string>();

  for (const row of [...input.assignments, ...targets]) {
    departments.set(row.departmentId, row.departmentName);
  }

  if (departments.size === 0) {
    return {
      title,
      sheets: [],
      emptyMessage: `Tidak ada roster confirmed untuk ${input.from} sampai ${input.to}.`,
    };
  }

  const taken = new Set<string>();
  const sheets: ExportSheet[] = [...departments]
    .sort(([idA, nameA], [idB, nameB]) =>
      compare(nameA.toLowerCase(), nameB.toLowerCase()) || compare(idA, idB),
    )
    .map(([departmentId, department]) => {
      const workers = input.assignments.filter((row) => row.departmentId === departmentId);
      const requests = targets.filter((row) => row.departmentId === departmentId);

      const positions = new Map<string, string>();

      for (const row of [...workers, ...requests]) {
        positions.set(row.positionId, row.positionName);
      }

      const orderedPositions = [...positions]
        .sort(([idA, nameA], [idB, nameB]) =>
          compare(nameA.toLowerCase(), nameB.toLowerCase()) || compare(idA, idB),
        );

      const dates = [...new Set([...workers, ...requests].map((row) => row.date))].sort(compare);
      const forms: ExportForm[] = [];

      for (const date of dates) {
        const requestRows = (rowsOf: ExportTargetRow[]): ExportRequestRow[] =>
          orderedPositions.map(([positionId, position]) => ({
            position,
            counts: shifts.map((shift) =>
              sumOrNull(
                rowsOf
                  .filter(
                    (row) =>
                      row.positionId === positionId && row.shiftId === shift.id && row.date === date,
                  )
                  .map((row) => row.headcount),
              ),
            ),
          }));
        const dayRequests = requestRows(requests);
        const total = shifts.map((_, index) =>
          sumOrNull(dayRequests.map((row) => row.counts[index] ?? 0)),
        );

        for (const shift of shifts) {
          const people = workers
            .filter((row) => row.date === date && row.shiftId === shift.id)
            .sort(byWorker);
          const hasRequest = requests.some((row) => row.date === date && row.shiftId === shift.id);

          if (people.length === 0 && !hasRequest) {
            continue;
          }

          forms.push({
            date,
            weekday: weekdayNameId(date),
            shiftOrder: shift.order,
            shiftLabels,
            workers: people.map((row, index) => ({
              no: index + 1,
              employeeId: row.employeeId,
              name: row.workerName,
              position: row.positionName,
            })),
            requestRows: dayRequests,
            total,
          });
        }
      }

      const name = exportSheetName(department, taken);

      taken.add(name);

      return { name, department, forms };
    });

  return { title, sheets, emptyMessage: null };
}
