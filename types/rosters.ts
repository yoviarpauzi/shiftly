import type { ReactNode } from "react";
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

// rosterId is set by generate, so the Generate screen can open the roster it made. warnings are the
// rules an edit broke and saved anyway: only those it introduced.
export type RosterActionResult =
  | { ok: true; message?: string; rosterId?: string; warnings?: string[] }
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

// One day of a worker's row in the grid. null is a day with no assignment. edited is set when the
// cell was changed by hand, warning when the cell breaks a rule.
export type RosterCell =
  | (({ kind: "work"; shiftOrder: number } | { kind: "off" } | { kind: "break" }) & {
      edited: boolean;
      warning: boolean;
    })
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

// What the grid's filters match a line on. The names are for the filter options.
export type RosterLineKeys = {
  departmentId: string;
  departmentName: string;
  subDepartmentId: string | null;
  subDepartmentName: string | null;
  positionId: string;
  positionName: string;
  // The shift the request fixed the line to, or null for Any shift.
  shiftId: string | null;
};

export type RosterLineView = RosterLineKeys & {
  lineId: string;
  title: string;
  // "Any shift" or "Shift N", shown after the title in the line's header.
  shiftLabel: string;
  // What the request asks for on each day.
  perDay: number[];
  workers: RosterWorkerRow[];
  unfilled: RosterUnfilled[];
};

// null means no filter. search matches a worker's name or employee ID. shiftOrder keeps the
// workers who work that shift on some day. attention keeps the lines that are short of workers and
// the workers with a cell that breaks a rule.
export type RosterLineFilters = {
  departmentId: string | null;
  subDepartmentId: string | null;
  positionId: string | null;
  shiftOrder: number | null;
  attention: boolean;
  search: string;
};

export type RosterLineOption = { id: string; name: string };

export type RosterLineOptions = {
  departments: RosterLineOption[];
  subDepartments: RosterLineOption[];
  positions: RosterLineOption[];
};

// The part of a line that sits on one page. A line cut by a page keeps its header on the next page;
// endsHere is true on the page that holds its last worker, which is where its Unfilled row goes.
export type RosterLineSlice = RosterLineView & { endsHere: boolean };

export type RosterPageSlices = {
  slices: RosterLineSlice[];
  // The page shown, after clamping to the pages that exist.
  page: number;
  pageCount: number;
};

export type RosterConflictView = {
  lineTitle: string;
  date: string;
  shiftOrder: number | null;
  shortfall: number;
  message: string;
};

// A rule warning as the panel lists it. workerId and workerName are null for a warning about a
// cell group, which marks the group's work cells instead of one worker's cell.
export type RosterWarningView = {
  lineId: string;
  lineTitle: string;
  workerId: string | null;
  workerName: string | null;
  date: string;
  message: string;
};

export type RosterCounts = {
  workers: number;
  shiftsAssigned: number;
  conflicts: number;
  edits: number;
  warnings: number;
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
  // The location's active shifts by order, for the cell menu.
  shifts: GenerateShift[];
  lines: RosterLineView[];
  conflicts: RosterConflictView[];
  warnings: RosterWarningView[];
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
  // "Any shift" or "Shift N", shown after the title in the line's header.
  shiftLabel: string;
  // The shift the request fixed this line to, or null when the line may be split.
  fixedShiftId: string | null;
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
  // The title, status, and dates. The action buttons sit beside it, so the view lays it out.
  header: ReactNode;
  roster: RosterDetail;
  generateInput: GenerateRosterInput | null;
};

// With a date and a shift order the dialog replaces one cell. Without them it replaces the whole row.
export type ReplaceWorkerDialogProps = {
  roster: { id: string; version: string };
  line: { lineId: string; title: string };
  worker: { workerId: string; name: string } | null;
  date?: string;
  shiftOrder?: number;
  onOpenChange: (open: boolean) => void;
};

type RosterDialogRoster = {
  id: string;
  version: string;
  // How many workers the rules could not find, over every shift.
  unfilled: number;
  edits: number;
  conflicts: number;
  // The rule warnings that stay on the roster when it is confirmed.
  warnings: number;
};

export type ConfirmRosterDialogProps = {
  roster: RosterDialogRoster;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type GenerateAgainDialogProps = ConfirmRosterDialogProps & {
  generateInput: GenerateRosterInput;
};

// What the grid needs to open the Replace dialog for one row, or for one cell of it when date and
// shiftOrder are set.
export type ReplaceTarget = {
  line: { lineId: string; title: string };
  worker: { workerId: string; name: string };
  date?: string;
  shiftOrder?: number;
};

// One work cell the Replace dialog is opened for.
export type SwapCellTarget = {
  lineId: string;
  lineTitle: string;
  workerId: string;
  workerName: string;
  date: string;
  shiftOrder: number;
};

// The line group the Add worker dialog is opened for.
export type AddWorkerTarget = { lineId: string; lineTitle: string };

export type RosterSummaryProps = { counts: RosterCounts };

export type ConflictsPanelProps = { conflicts: RosterConflictView[] };

export type WarningsPanelProps = { warnings: RosterWarningView[] };

export type RosterGridFiltersProps = {
  filters: RosterLineFilters;
  options: RosterLineOptions;
  shifts: GenerateShift[];
  // Conflicts and warnings together, shown on the Needs attention button.
  attentionCount: number;
  // The lines Add worker can add to, or null when the roster cannot be changed.
  addTargets: AddWorkerTarget[] | null;
  onAddWorker: (target: AddWorkerTarget) => void;
  onChange: (patch: Partial<RosterLineFilters>) => void;
  onClear: () => void;
};

export type RosterGridProps = {
  days: string[];
  shifts: GenerateShift[];
  // The lines of the page shown, each with the workers on that page.
  lines: RosterLineSlice[];
  // "12 workers in 3 of 5 lines", shown above the grid.
  summary: string;
  // The shift filter's shift. The work cells of other shifts are dimmed so this one stands out.
  focusShift: number | null;
  // True for a draft: only a draft has cell buttons, the row menu, and Add worker.
  editable: boolean;
  onReplace: (target: ReplaceTarget) => void;
  // Resolves when the edit is saved or refused, so the grid keeps its buttons disabled until then.
  onEditCell: (change: CellChange) => Promise<void>;
  onSwapCell: (target: SwapCellTarget) => void;
};

export type CellMenuProps = {
  // The cell button's accessible name, such as "Edit Budi Santoso, Tue 10 Nov".
  label: string;
  cell: RosterCell;
  shifts: GenerateShift[];
  disabled: boolean;
  onChoose: (to: CellTarget) => void;
  onReplace: () => void;
  // The cell's visual: a shift chip, OFF, BREAK, or a dot.
  children: ReactNode;
};

// A candidate as the Replace dialog lists it, from either action. hard are the reasons that make
// the worker impossible, warnings the rules the replacement would break.
export type ReplaceOption = {
  workerId: string;
  employeeId: string;
  name: string;
  positionNames: string[];
  hard: string[];
  warnings: string[];
};

// A worker the Add worker dialog offers.
export type AddableWorker = {
  workerId: string;
  employeeId: string;
  name: string;
  positionNames: string[];
};

// What editing one cell would do, as previewCellChange answers.
export type CellPreview = { hard: string | null; warnings: string[] };

// The Add worker form's values. choice is a shift's id, or "off" or "break".
export type AddWorkerValues = { workerId: string; date: string; choice: string };

// A preview answer belongs to the choice it was asked for.
export type PreviewAnswer = { key: string; preview: CellPreview | null };

export type AddWorkerDialogProps = {
  roster: { id: string; version: string; days: string[]; shifts: GenerateShift[] };
  // Null while the dialog is closed.
  line: AddWorkerTarget | null;
  onOpenChange: (open: boolean) => void;
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
  // Empty when the worker can take the row. Hard and warning reasons together, in a fixed order.
  reasons: string[];
  // True when at least one reason makes the worker impossible, not just a rule to warn about.
  hard: boolean;
};

// A worker who could take over one cell. hard is why the worker cannot, null when they can, and
// warnings are the rules the swap would break. inRoster is true when the worker has any cell in it.
export type CellCandidate = {
  workerId: string;
  employeeId: string;
  name: string;
  positionNames: string[];
  hard: string | null;
  warnings: string[];
  inRoster: boolean;
};

// An active worker of a location, with the names of their positions.
export type LocationWorker = {
  id: string;
  employeeId: string;
  name: string;
  positionNames: string[];
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

export type EngineLine = {
  id: string;
  positionId: string;
  departmentId: string;
  subDepartmentId: string | null;
};

export type EngineTarget = { lineId: string; date: string; shiftId: string; headcount: number };

export type EngineRules = {
  workDaysPerWeek: number;
  shiftExceptionDays: number;
  requirePositionMatch: boolean;
  keepPreviousPlacement: boolean;
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
  // The department and sub-department of the last work day before the roster, or null.
  lastPlacement: { departmentId: string; subDepartmentId: string | null } | null;
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

// ---- Rule warnings on an edited roster. An edit is never refused for a rule, it is warned about.

export type WarningCode = "position" | "contract" | "weekly" | "shiftMove" | "monthly" | "over";

// workerId and shiftOrder are null when the warning is about a cell group, not one worker's cell.
export type RosterWarning = {
  code: WarningCode;
  lineId: string;
  workerId: string | null;
  date: string;
  shiftOrder: number | null;
  message: string;
};

export type EvalCell = {
  lineId: string;
  workerId: string;
  date: string;
  kind: AssignmentKind;
  shiftOrder: number | null;
  shiftId: string | null;
};

export type EvaluateInput = {
  days: string[];
  lines: { id: string; positionId: string; positionName: string }[];
  // workDaysPerWeek is the worker's own limit, or null to follow the rule.
  workers: { id: string; endContract: string; positionIds: string[]; workDaysPerWeek: number | null }[];
  cells: EvalCell[];
  targets: { lineId: string; date: string; shiftOrder: number; headcount: number }[];
  rules: EngineRules;
  history: EngineHistory[];
};

// ---- Editing one cell of a draft roster.

// What a cell becomes. clear removes the worker's cell for that day.
export type CellTarget =
  | { kind: "work"; shiftId: string; shiftOrder: number }
  | { kind: "off" }
  | { kind: "break" }
  | { kind: "clear" };

export type CellChange = { lineId: string; workerId: string; date: string; to: CellTarget };

// What evaluating and storing one cell edit reads from the database. workers are the listed
// workers, cells every assignment of the roster, busy the days a listed worker works in another
// roster, and previousConflicts the roster's stored conflicts before the edit.
export type CellContext = {
  dates: string[];
  shifts: { id: string; order: number }[];
  line: { id: string; positionId: string; positionName: string };
  workers: {
    id: string;
    employeeId: string;
    name: string;
    endContract: string;
    positionIds: string[];
    workDaysPerWeek: number | null;
    positionNames: string[];
    active: boolean;
  }[];
  cells: EvalCell[];
  targets: { lineId: string; date: string; shiftId: string; shiftOrder: number; headcount: number }[];
  busy: { workerId: string; date: string }[];
  history: EngineHistory[];
  rules: EngineRules;
  previousConflicts: {
    lineId: string;
    date: string;
    shiftId: string | null;
    shortfall: number;
    message: string;
  }[];
  lines: { id: string; positionId: string; positionName: string }[];
};

export type CellContextResult =
  | { ok: true; context: CellContext }
  | { ok: false; reason: "line" | "worker" | "date" };

// A stored shortage: a shift that has fewer workers than its target.
export type ShortageRow = {
  lineId: string;
  date: string;
  shiftId: string;
  shortfall: number;
  message: string;
};

// ---- The walks the replacement check and the roster evaluation share.

// One work cell of a worker, in date order. Off and break cells are left out before the walk.
export type WalkCell = { date: string; shiftOrder: number | null };

// A move to a lower shift that is refused. index is the cell's position in the walked cells.
export type ShiftMoveEvent = {
  index: number;
  date: string;
  previousOrder: number;
  order: number;
  run: number;
};

// The first cell that takes a month past the limit. month is YYYY-MM.
export type MonthlyOverrunEvent = { index: number; date: string; month: string };

// A reason a candidate breaks a rule. A hard one makes the candidate impossible, the others are
// rules an editor may knowingly break.
export type Reason = { hard: boolean; text: string };
