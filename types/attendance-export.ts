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

export type ExportWorkerLine = {
  // Counts from 1 in each form.
  no: number;
  employeeId: string;
  name: string;
  position: string;
};

// One position of the request table. counts has one entry per shift column, null for zero.
export type ExportRequestRow = { position: string; counts: (number | null)[] };

export type ExportForm = {
  date: string;
  weekday: string;
  shiftOrder: number;
  // "S1", "S2", ... one per shift column of the request table.
  shiftLabels: string[];
  workers: ExportWorkerLine[];
  requestRows: ExportRequestRow[];
  total: (number | null)[];
};

export type ExportSheet = { name: string; department: string; forms: ExportForm[] };

// emptyMessage is set when the week has nothing to export, and then sheets is empty.
export type ExportModel = { title: string; sheets: ExportSheet[]; emptyMessage: string | null };

// href is the export URL for the chosen location and date, or null while no single location is chosen.
export type AttendanceExportButtonProps = { href: string | null };
