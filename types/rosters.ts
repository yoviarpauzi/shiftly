import type { PageParams } from "@/types/pagination";
import type { Transaction } from "@/types/requests";
import type { SortCriterion } from "@/types/sort";
import type { GenerateRosterInput } from "@/validation/rosters";

// Anything that can run a select: the database itself or a transaction.
export type Reader = Pick<Transaction, "select">;

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

// The first day whose per-shift headcounts do not add up to the request's headcount.
export type TargetsTotalError = { dayIndex: number; sum: number; required: number };

// rosterId is set by generate, so the Generate screen can open the roster it made.
export type RosterActionResult =
  | { ok: true; message?: string; rosterId?: string }
  | { ok: false; formError: string; fieldErrors?: Record<string, string> };

export type RosterSortColumn = "po" | "type" | "date" | "location" | "status";

export type RosterListParams = PageParams &
  RosterFilters & { sort: SortCriterion<RosterSortColumn>[] };

// One approved request. rosterId, conflictCount, and updatedAt are null until a roster exists.
export type RosterRow = {
  requestId: string;
  poNumber: string;
  type: "daily" | "weekly";
  startDate: string;
  days: number;
  locationName: string;
  siteName: string;
  status: RosterListStatus;
  conflictCount: number | null;
  updatedAt: string | null;
  rosterId: string | null;
};

export type RosterPage = {
  rows: RosterRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type RosterDataTableProps = { page: RosterPage };

export type RosterFiltersProps = {
  filters: RosterFilters;
  // Empty unless the actor picks the site: a superadmin with more than one site.
  sites: { id: string; name: string }[];
  // The locations the location filter offers. Fewer than two hides the filter.
  locations: { id: string; name: string; siteId: string }[];
};

export type RosterStatusBadgeProps = { status: RosterListStatus };

// One day of a worker's row in the grid. null is a day with no assignment.
export type RosterCell =
  | { kind: "work"; shiftOrder: number }
  | { kind: "off" }
  | { kind: "break" }
  | null;

export type RosterWorkerRow = {
  workerId: string;
  employeeId: string;
  name: string;
  // True when the worker took over this row from another worker.
  replaced: boolean;
  cells: RosterCell[];
};

export type RosterUnfilled = { date: string; shiftOrder: number; shortfall: number };

export type RosterLineView = {
  lineId: string;
  title: string;
  // What the request asks for on each day.
  perDay: number[];
  workers: RosterWorkerRow[];
  unfilled: RosterUnfilled[];
};

export type RosterConflictView = {
  lineTitle: string;
  date: string;
  shiftOrder: number | null;
  shortfall: number;
  message: string;
};

export type RosterCounts = {
  workers: number;
  shiftsAssigned: number;
  conflicts: number;
  edits: number;
};

export type RosterDetail = {
  id: string;
  requestId: string;
  poNumber: string;
  type: "daily" | "weekly";
  startDate: string;
  locationName: string;
  siteName: string;
  status: RosterStatus;
  // False once the roster is confirmed or its request is no longer approved: no replacing,
  // generating again, or confirming.
  editable: boolean;
  generatedByName: string | null;
  generatedAt: string;
  confirmedByName: string | null;
  confirmedAt: string | null;
  // The roster's updatedAt as ISO text. Actions compare against it.
  version: string;
  days: string[];
  lines: RosterLineView[];
  conflicts: RosterConflictView[];
  counts: RosterCounts;
};

export type GenerateShift = {
  id: string;
  name: string;
  order: number;
  startTime: string;
  endTime: string;
};

export type GenerateLine = {
  lineId: string;
  title: string;
  required: number[];
  // split[day][shiftIndex], in the order of GenerateView.shifts.
  split: number[][];
};

export type GenerateView = {
  requestId: string;
  poNumber: string;
  type: "daily" | "weekly";
  startDate: string;
  locationName: string;
  days: string[];
  shifts: GenerateShift[];
  lines: GenerateLine[];
  existingRosterId: string | null;
  // A confirmed roster cannot be generated again, so the page opens it instead.
  existingStatus: RosterStatus | null;
  version: string | null;
};

// generateInput is the split the draft was generated with and its current version, so Generate
// again can repeat it. It is null when the request is no longer approved.
export type RosterDetailProps = {
  roster: RosterDetail;
  generateInput: GenerateRosterInput | null;
};

export type ReplaceWorkerDialogProps = {
  roster: { id: string; version: string };
  line: { lineId: string; title: string };
  worker: { workerId: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
};

type RosterDialogRoster = {
  id: string;
  version: string;
  // How many workers the rules could not find, over every shift.
  unfilled: number;
  edits: number;
  conflicts: number;
};

export type ConfirmRosterDialogProps = {
  roster: RosterDialogRoster;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type GenerateAgainDialogProps = ConfirmRosterDialogProps & {
  generateInput: GenerateRosterInput;
};

// What the grid needs to open the Replace dialog for one row.
export type ReplaceTarget = {
  line: { lineId: string; title: string };
  worker: { workerId: string; name: string };
};

export type RosterSummaryProps = { counts: RosterCounts };

export type ConflictsPanelProps = { conflicts: RosterConflictView[] };

export type RosterGridProps = {
  days: string[];
  lines: RosterLineView[];
  // True for a draft: only a draft has the row menu.
  editable: boolean;
  onReplace: (target: ReplaceTarget) => void;
};

export type GenerateFormProps = { view: GenerateView };

export type ShiftGridProps = {
  line: GenerateLine;
  days: string[];
  shifts: GenerateShift[];
  // The first day that does not add up, or null when every day does.
  invalidDay: number | null;
  disabled: boolean;
  onChange: (day: number, shiftIndex: number, value: number) => void;
};

export type ReplacementCandidate = {
  workerId: string;
  employeeId: string;
  name: string;
  positionNames: string[];
  // Empty when the worker can take the row.
  reasons: string[];
};

// The engine's input without its targets, which come from the Generate screen.
export type LoadedEngineInput = {
  input: Omit<RosterEngineInput, "targets">;
  location: { id: string; siteId: string };
};

// A worker who could take over a row, with what checkReplacement needs to judge them.
export type ReplacementCandidateContext = {
  id: string;
  employeeId: string;
  name: string;
  endContract: string;
  positionIds: string[];
  positionNames: string[];
  alreadyInRoster: boolean;
  otherRosterWorkDates: string[];
  history: EngineHistory;
};

export type ReplacementContext = {
  row: ReplacementRowDay[];
  position: { id: string; name: string };
  rules: EngineRules;
  candidates: ReplacementCandidateContext[];
};

export type ReplacementContextResult =
  | { ok: true; context: ReplacementContext }
  | { ok: false; reason: "line" | "worker" };

// ---- Rule engine input and output. Dates are YYYY-MM-DD.

export type EngineShift = { id: string; order: number };

export type EngineWorker = {
  id: string;
  employeeId: string;
  endContract: string;
  positionIds: string[];
  // The worker's own working days per week, or null to follow the rule.
  workDaysPerWeek: number | null;
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

// ---- Replacing a worker. The candidate takes the replaced worker's whole row.

// One day of the replaced worker's row. shiftOrder is set on a work day.
export type ReplacementRowDay = {
  date: string;
  kind: AssignmentKind;
  shiftOrder: number | null;
};

export type ReplacementInput = {
  // The replaced worker's days in this roster, in date order.
  row: ReplacementRowDay[];
  candidate: { id: string; endContract: string; positionIds: string[] };
  position: { id: string; name: string };
  alreadyInRoster: boolean;
  // Days the candidate already works in another roster.
  otherRosterWorkDates: string[];
  history: EngineHistory;
  rules: EngineRules;
};

export type ReplacementResult = { ok: true } | { ok: false; reasons: string[] };
