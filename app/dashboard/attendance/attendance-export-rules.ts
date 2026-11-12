import { addDays } from "@/app/dashboard/rosters/roster-rules";
import type {
  ExportAssignmentRow,
  ExportBand,
  ExportDay,
  ExportInput,
  ExportModel,
  ExportRequestRow,
  ExportSheet,
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
    // The cut can leave a space or an apostrophe at the end, and Excel rejects a name that ends in
    // an apostrophe.
    const name = `${base.slice(0, SHEET_MAX_LENGTH - suffix.length).replace(/[\s']+$/, "")}${suffix}`;

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

// The forms of the printed template sit three across, so a day with more shifts than that goes on
// to the next band.
const FORMS_PER_BAND = 3;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }

  return out;
}

// The sheets of the workbook: one per department that has a worker or a request headcount in the
// week. Each day has bands of up to three shift forms side by side, and a form is written only for a
// shift that has a worker or a headcount, so no empty form is printed. The request table of a band
// has a column for each of its shifts.
export function buildExportModel(input: ExportInput): ExportModel {
  const title = `ABSENSI DAILY HELPER ${input.locationName.toUpperCase()}`;
  const shifts = [...input.shifts].sort((a, b) => a.order - b.order || compare(a.id, b.id));
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

      const orderedPositions = [...positions].sort(
        ([idA, nameA], [idB, nameB]) =>
          compare(nameA.toLowerCase(), nameB.toLowerCase()) || compare(idA, idB),
      );

      const dates = [...new Set([...workers, ...requests].map((row) => row.date))].sort(compare);

      const days: ExportDay[] = dates.map((date) => {
        const withForm = shifts.filter(
          (shift) =>
            workers.some((row) => row.date === date && row.shiftId === shift.id) ||
            requests.some((row) => row.date === date && row.shiftId === shift.id),
        );

        const bands: ExportBand[] = chunks(withForm, FORMS_PER_BAND).map((group) => {
          const requestRows: ExportRequestRow[] = orderedPositions.map(([positionId, position]) => ({
            position,
            counts: group.map((shift) =>
              sumOrNull(
                requests
                  .filter(
                    (row) =>
                      row.positionId === positionId && row.shiftId === shift.id && row.date === date,
                  )
                  .map((row) => row.headcount),
              ),
            ),
          }));

          return {
            shiftLabels: group.map((shift) => `S${shift.order}`),
            forms: group.map((shift) => ({
              shiftOrder: shift.order,
              workers: workers
                .filter((row) => row.date === date && row.shiftId === shift.id)
                .sort(byWorker)
                .map((row) => ({
                  employeeId: row.employeeId,
                  name: row.workerName,
                  position: row.positionName,
                })),
            })),
            requestRows,
            total: group.map((_, index) =>
              sumOrNull(requestRows.map((row) => row.counts[index] ?? 0)),
            ),
          };
        });

        return { date, weekday: weekdayNameId(date), bands };
      });

      const name = exportSheetName(department, taken);

      taken.add(name);

      return { name, department, days };
    });

  return { title, sheets, emptyMessage: null };
}
