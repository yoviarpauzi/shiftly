export type RosterStatus = "draft" | "confirmed";

// An approved request with no roster yet shows as "not-generated" in the list.
export type RosterListStatus = RosterStatus | "not-generated";

export type RosterStatusFilter = RosterListStatus | "all";

export type AssignmentKind = "work" | "off" | "break";

// The filters of the Roster list, read from the URL.
export type RosterFilters = {
  status: RosterStatusFilter;
  type: "all" | "daily" | "weekly";
  siteId: string | null;
  locationId: string | null;
  query: string;
};

export type RosterActionResult =
  | { ok: true; message?: string }
  | { ok: false; formError: string; fieldErrors?: Record<string, string> };

// ---- Rule engine input and output. Dates are YYYY-MM-DD.

export type EngineShift = { id: string; order: number };

export type EngineWorker = {
  id: string;
  employeeId: string;
  endContract: string;
  positionIds: string[];
};

export type EngineLine = { id: string; positionId: string };

export type EngineTarget = { lineId: string; date: string; shiftId: string; headcount: number };

export type EngineRules = {
  workDaysPerWeek: number;
  shiftExceptionDays: number;
  requirePositionMatch: boolean;
  maxWorkingDaysPerMonth: number;
};

// What a worker did before the first day of the roster, from confirmed rosters. monthWorkDays is
// keyed by YYYY-MM.
export type EngineHistory = {
  workerId: string;
  lastWorkDate: string | null;
  lastShiftOrder: number | null;
  consecutiveWorkDays: number;
  monthWorkDays: Record<string, number>;
};

export type RosterEngineInput = {
  days: string[];
  lines: EngineLine[];
  targets: EngineTarget[];
  shifts: EngineShift[];
  workers: EngineWorker[];
  rules: EngineRules;
  history: EngineHistory[];
};

export type EngineAssignment = {
  lineId: string;
  workerId: string;
  date: string;
  kind: "work" | "off";
  shiftId: string | null;
};

export type EngineConflict = {
  lineId: string;
  date: string;
  shiftId: string;
  code: "shortage";
  shortfall: number;
  message: string;
};

export type RosterEngineOutput = {
  assignments: EngineAssignment[];
  conflicts: EngineConflict[];
};
