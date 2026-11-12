// One scheduled work day of one worker, as the export query returns it. date is YYYY-MM-DD.
export type ExportAssignmentRow = {
  employeeId: string;
  workerName: string;
  departmentId: string;
  departmentName: string;
  positionId: string;
  positionName: string;
  date: string;
  shiftId: string;
  shiftOrder: number;
};

// How many workers a position needs on a shift and day: the split typed on the Generate screen.
export type ExportTargetRow = {
  departmentId: string;
  departmentName: string;
  positionId: string;
  positionName: string;
  date: string;
  shiftId: string;
  shiftOrder: number;
  headcount: number;
};

export type ExportInput = {
  locationName: string;
  // The week, Monday to Sunday, as YYYY-MM-DD.
  from: string;
  to: string;
  shifts: { id: string; order: number }[];
  assignments: ExportAssignmentRow[];
  targets: ExportTargetRow[];
};

// One worker on a form. The slot number is the worker's place on the form, not stored here.
export type ExportWorkerLine = {
  employeeId: string;
  name: string;
  position: string;
};

// One position of the request table. counts has one entry per shift column of the band, null for zero.
export type ExportRequestRow = { position: string; counts: (number | null)[] };

// The form of one shift on one day.
export type ExportForm = { shiftOrder: number; workers: ExportWorkerLine[] };

// Up to three shift forms side by side, with the request table under them. The table has a column
// for each shift of the band, so a shift of the day beyond the third goes to the next band.
export type ExportBand = {
  // "S1", "S2", ... one per form of the band, in the same order.
  shiftLabels: string[];
  forms: ExportForm[];
  requestRows: ExportRequestRow[];
  total: (number | null)[];
};

export type ExportDay = { date: string; weekday: string; bands: ExportBand[] };

export type ExportSheet = { name: string; department: string; days: ExportDay[] };

// emptyMessage is set when the week has nothing to export, and then sheets is empty. title is the
// heading of every form, in capitals.
export type ExportModel = { title: string; sheets: ExportSheet[]; emptyMessage: string | null };

// href is the export URL for the chosen location and date, or null while no single location is chosen.
export type AttendanceExportButtonProps = { href: string | null };
