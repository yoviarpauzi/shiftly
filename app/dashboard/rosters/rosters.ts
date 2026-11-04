import "server-only";
import {
  and,
  asc,
  between,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  notInArray,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { toHourMinute } from "@/app/dashboard/shifts/shift-rules";
import { user } from "@/database/schema/auth-schema";
import { department, subDepartment } from "@/database/schema/department-schema";
import { location } from "@/database/schema/location-schema";
import { position } from "@/database/schema/position-schema";
import { rosterRequest, rosterRequestLine, rosterRequestLineDay } from "@/database/schema/request-schema";
import {
  roster,
  rosterAssignment,
  rosterCellEdit,
  rosterConflict,
  rosterEdit,
  rosterShiftTarget,
} from "@/database/schema/roster-schema";
import { shift } from "@/database/schema/shift-schema";
import { site } from "@/database/schema/site-schema";
import { worker, workerPosition } from "@/database/schema/worker-schema";
import { db } from "@/lib/db";
import { clampPage, escapeLikePattern } from "@/lib/pagination";
import { sortTerms } from "@/lib/sort";
import type { RequestAccess } from "@/types/requests";
import type {
  AssignmentKind,
  CellContextResult,
  EngineHistory,
  EvalCell,
  GenerateLine,
  GenerateShift,
  GenerateView,
  LoadedEngineInput,
  LocationWorker,
  Reader,
  ReplacementCandidate,
  ReplacementContextResult,
  RosterConflictView,
  RosterCounts,
  RosterDetail,
  RosterLineView,
  RosterListParams,
  RosterPage,
  RosterRow,
  RosterSortColumn,
  RosterStatus,
  RosterWarning,
} from "@/types/rosters";
import type { SortCriterion } from "@/types/sort";
import { parseRequestId } from "@/validation/request-id";
import { requestScopeFilter } from "../requests/requests";
import { evaluateRoster } from "./roster-evaluation";
import { checkReplacement, checkReplacementDetailed } from "./roster-replacement";
import {
  addDays,
  evenSplit,
  fixedSplit,
  isRosterEditable,
  monthKey,
  requestDays,
  shiftLabel,
} from "./roster-rules";
import { loadEngineRules } from "./roster-work-rules";

const DEFAULT_SORT: SortCriterion<RosterSortColumn>[] = [
  { column: "date", direction: "desc" },
  { column: "po", direction: "desc" },
];

// An approved request with no roster row has no status of its own, so the list gives it one.
const LIST_STATUS = sql<string>`coalesce(${roster.status}, 'not-generated')`;

const ROSTER_SORT_EXPRESSIONS: Record<RosterSortColumn, SQLWrapper> = {
  po: rosterRequest.poNumber,
  type: rosterRequest.type,
  date: rosterRequest.startDate,
  location: location.name,
  status: LIST_STATUS,
};

// How far back the history looks for the run that ends the day before a roster. Weekly and monthly
// limits keep a real run far shorter than this.
const HISTORY_LOOKBACK_DAYS = 60;

// ---- Pure shaping helpers. They take rows as the queries return them.

type ListRowInput = {
  requestId: string;
  poNumber: string;
  type: string;
  startDate: string;
  locationName: string;
  siteName: string;
  rosterId: string | null;
  rosterStatus: string | null;
  conflictCount: number | null;
  updatedAt: Date | null;
};

export function shapeRosterRow(row: ListRowInput): RosterRow {
  const hasRoster = row.rosterId !== null;
  const type = row.type === "weekly" ? "weekly" : "daily";

  return {
    requestId: row.requestId,
    poNumber: row.poNumber,
    type,
    startDate: row.startDate,
    days: type === "weekly" ? 7 : 1,
    locationName: row.locationName,
    siteName: row.siteName,
    status: hasRoster ? (row.rosterStatus as RosterStatus) : "not-generated",
    conflictCount: hasRoster ? (row.conflictCount ?? 0) : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    rosterId: row.rosterId,
  };
}

// "<department> / <sub-department> / <position>", without the sub-department when there is none.
export function lineTitle(departmentName: string, subDepartmentName: string | null, positionName: string) {
  return [departmentName, subDepartmentName, positionName].filter(Boolean).join(" / ");
}

type LineHead = { lineId: string; title: string; shiftLabel: string; perDay: number[] };

type AssignmentRow = {
  lineId: string;
  workerId: string;
  employeeId: string;
  name: string;
  date: string;
  kind: AssignmentKind;
  shiftOrder: number | null;
};

type ConflictRow = {
  lineId: string;
  date: string;
  shiftOrder: number | null;
  shortfall: number;
  message: string;
};

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// One block per line: a row per worker with a cell per day, and what the line could not fill.
// editedKeys and warningKeys hold "lineId|workerId|date" for the cells to flag.
export function buildLineViews(input: {
  days: string[];
  lines: LineHead[];
  assignments: AssignmentRow[];
  conflicts: ConflictRow[];
  replacedIn: { lineId: string; workerId: string }[];
  editedKeys: Set<string>;
  warningKeys: Set<string>;
}): RosterLineView[] {
  const replaced = new Set(input.replacedIn.map((edit) => `${edit.lineId}|${edit.workerId}`));

  return input.lines.map((line) => {
    const workers = new Map<string, RosterLineView["workers"][number]>();

    for (const row of input.assignments) {
      if (row.lineId !== line.lineId) continue;

      let entry = workers.get(row.workerId);

      if (!entry) {
        entry = {
          workerId: row.workerId,
          employeeId: row.employeeId,
          name: row.name,
          replaced: replaced.has(`${line.lineId}|${row.workerId}`),
          cells: input.days.map(() => null),
        };
        workers.set(row.workerId, entry);
      }

      const index = input.days.indexOf(row.date);

      if (index === -1) continue;

      const key = `${line.lineId}|${row.workerId}|${row.date}`;
      const flags = { edited: input.editedKeys.has(key), warning: input.warningKeys.has(key) };

      entry.cells[index] =
        row.kind === "work"
          ? { kind: "work", shiftOrder: row.shiftOrder ?? 0, ...flags }
          : { kind: row.kind, ...flags };
    }

    const unfilled = input.conflicts
      .filter((conflict) => conflict.lineId === line.lineId && conflict.shiftOrder !== null)
      .map((conflict) => ({
        date: conflict.date,
        shiftOrder: conflict.shiftOrder as number,
        shortfall: conflict.shortfall,
      }))
      .sort((a, b) => byText(a.date, b.date) || a.shiftOrder - b.shiftOrder);

    return {
      lineId: line.lineId,
      title: line.title,
      shiftLabel: line.shiftLabel,
      perDay: line.perDay,
      workers: [...workers.values()].sort(
        (a, b) =>
          byText(a.employeeId.toLowerCase(), b.employeeId.toLowerCase()) ||
          byText(a.workerId, b.workerId),
      ),
      unfilled,
    };
  });
}

// The cells the grid marks as breaking a rule, as "lineId|workerId|date". A warning about a worker
// marks that worker's cell. A warning about a cell group, such as a shift with more workers than it
// needs, has no worker, so it marks every work cell of its line, day, and shift.
export function warningCellKeys(warnings: RosterWarning[], cells: EvalCell[]): Set<string> {
  const keys = new Set<string>();

  for (const warning of warnings) {
    if (warning.workerId !== null) {
      keys.add(`${warning.lineId}|${warning.workerId}|${warning.date}`);
      continue;
    }

    if (warning.shiftOrder === null) {
      continue;
    }

    for (const cell of cells) {
      if (
        cell.kind === "work" &&
        cell.lineId === warning.lineId &&
        cell.date === warning.date &&
        cell.shiftOrder === warning.shiftOrder
      ) {
        keys.add(`${cell.lineId}|${cell.workerId}|${cell.date}`);
      }
    }
  }

  return keys;
}

// The conflicts as the summary lists them: by date, then line, then shift.
export function buildConflictViews(lines: LineHead[], conflicts: ConflictRow[]): RosterConflictView[] {
  const titles = new Map(lines.map((line) => [line.lineId, line.title]));
  const position = new Map(lines.map((line, index) => [line.lineId, index]));
  const order = (value: number | null) => value ?? Number.MAX_SAFE_INTEGER;

  return [...conflicts]
    .sort(
      (a, b) =>
        byText(a.date, b.date) ||
        (position.get(a.lineId) ?? 0) - (position.get(b.lineId) ?? 0) ||
        order(a.shiftOrder) - order(b.shiftOrder),
    )
    .map((conflict) => ({
      lineTitle: titles.get(conflict.lineId) ?? "",
      date: conflict.date,
      shiftOrder: conflict.shiftOrder,
      shortfall: conflict.shortfall,
      message: conflict.message,
    }));
}

export function rosterCounts(
  assignments: AssignmentRow[],
  conflicts: number,
  edits: number,
  warnings: number,
): RosterCounts {
  return {
    workers: new Set(assignments.map((row) => row.workerId)).size,
    shiftsAssigned: assignments.filter((row) => row.kind === "work").length,
    conflicts,
    edits,
    warnings,
  };
}

// What a worker did before the roster, from the confirmed work rows around it. The run counts back
// from the last work day before the first day while the days stay consecutive. The month counts
// cover only the months the roster touches, and include work on or after the first day.
export function workerHistory(
  workerId: string,
  rows: { date: string; shiftOrder: number }[],
  firstDay: string,
  months: string[],
): EngineHistory {
  const before = rows.filter((row) => row.date < firstDay).sort((a, b) => byText(a.date, b.date));
  const last = before[before.length - 1];
  const worked = new Set(before.map((row) => row.date));

  let consecutiveWorkDays = 0;

  if (last) {
    for (let date = last.date; worked.has(date); date = addDays(date, -1)) {
      consecutiveWorkDays += 1;
    }
  }

  const monthWorkDays: Record<string, number> = {};

  for (const row of rows) {
    const key = monthKey(row.date);

    if (months.includes(key)) {
      monthWorkDays[key] = (monthWorkDays[key] ?? 0) + 1;
    }
  }

  return {
    workerId,
    lastWorkDate: last?.date ?? null,
    lastShiftOrder: last?.shiftOrder ?? null,
    consecutiveWorkDays,
    monthWorkDays,
  };
}

// ---- Queries.

function rosterListFilter(
  access: RequestAccess,
  { query, status, type, siteId, locationId }: RosterListParams,
) {
  const pattern = `%${escapeLikePattern(query)}%`;

  return and(
    eq(rosterRequest.status, "approved"),
    requestScopeFilter(access),
    siteId ? eq(rosterRequest.siteId, siteId) : undefined,
    locationId ? eq(rosterRequest.locationId, locationId) : undefined,
    status === "not-generated"
      ? isNull(roster.id)
      : status !== "all"
        ? eq(roster.status, status)
        : undefined,
    type !== "all" ? eq(rosterRequest.type, type) : undefined,
    query ? ilike(rosterRequest.poNumber, pattern) : undefined,
  );
}

// Approved requests in the actor's scope, each with its roster if one exists.
export async function listRosters(
  access: RequestAccess,
  params: RosterListParams,
): Promise<RosterPage> {
  const { page, pageSize, sort } = params;
  const filter = rosterListFilter(access, params);
  const criteria = sort.length > 0 ? sort : DEFAULT_SORT;

  const [{ total }] = await db
    .select({ total: count() })
    .from(rosterRequest)
    .leftJoin(roster, eq(roster.requestId, rosterRequest.id))
    .where(filter);

  const currentPage = clampPage(page, total, pageSize);

  const conflictCounts = db
    .select({ rosterId: rosterConflict.rosterId, conflictCount: count().as("conflict_count") })
    .from(rosterConflict)
    .groupBy(rosterConflict.rosterId)
    .as("conflict_counts");

  const rows = await db
    .select({
      requestId: rosterRequest.id,
      poNumber: rosterRequest.poNumber,
      type: rosterRequest.type,
      startDate: rosterRequest.startDate,
      locationName: location.name,
      siteName: site.name,
      rosterId: roster.id,
      rosterStatus: roster.status,
      conflictCount: conflictCounts.conflictCount,
      updatedAt: roster.updatedAt,
    })
    .from(rosterRequest)
    .innerJoin(location, eq(location.id, rosterRequest.locationId))
    .innerJoin(site, eq(site.id, rosterRequest.siteId))
    .leftJoin(roster, eq(roster.requestId, rosterRequest.id))
    .leftJoin(conflictCounts, eq(conflictCounts.rosterId, roster.id))
    .where(filter)
    .orderBy(
      ...sortTerms(criteria, ROSTER_SORT_EXPRESSIONS),
      criteria[criteria.length - 1].direction === "desc"
        ? desc(rosterRequest.id)
        : asc(rosterRequest.id),
    )
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  return { rows: rows.map(shapeRosterRow), total, page: currentPage, pageSize };
}

type RequestLineRow = LineHead & {
  positionId: string;
  positionName: string;
  // The shift the request fixed the line to, or null for Any shift.
  shiftId: string | null;
};

// The lines of a request in id order, each with its headcount for every day.
export async function loadRequestLines(reader: Reader, requestId: string): Promise<RequestLineRow[]> {
  const lineRows = await reader
    .select({
      lineId: rosterRequestLine.id,
      positionId: rosterRequestLine.positionId,
      positionName: position.name,
      departmentName: department.name,
      subDepartmentName: subDepartment.name,
      shiftId: rosterRequestLine.shiftId,
      shiftOrder: shift.order,
    })
    .from(rosterRequestLine)
    .innerJoin(department, eq(department.id, rosterRequestLine.departmentId))
    .innerJoin(position, eq(position.id, rosterRequestLine.positionId))
    .leftJoin(subDepartment, eq(subDepartment.id, rosterRequestLine.subDepartmentId))
    // No deletedAt filter: a line keeps its shift, and so its label, after a soft delete.
    .leftJoin(shift, eq(shift.id, rosterRequestLine.shiftId))
    .where(eq(rosterRequestLine.requestId, requestId))
    .orderBy(asc(rosterRequestLine.id));

  const dayRows = await reader
    .select({ lineId: rosterRequestLineDay.lineId, headcount: rosterRequestLineDay.headcount })
    .from(rosterRequestLineDay)
    .innerJoin(rosterRequestLine, eq(rosterRequestLine.id, rosterRequestLineDay.lineId))
    .where(eq(rosterRequestLine.requestId, requestId))
    .orderBy(asc(rosterRequestLineDay.lineId), asc(rosterRequestLineDay.dayOffset));

  const perLine = new Map<string, number[]>();

  for (const day of dayRows) {
    perLine.set(day.lineId, [...(perLine.get(day.lineId) ?? []), day.headcount]);
  }

  return lineRows.map((row) => ({
    lineId: row.lineId,
    positionId: row.positionId,
    positionName: row.positionName,
    title: lineTitle(row.departmentName, row.subDepartmentName, row.positionName),
    shiftId: row.shiftId,
    shiftLabel: shiftLabel(row.shiftId === null ? null : (row.shiftOrder ?? null)),
    perDay: perLine.get(row.lineId) ?? [],
  }));
}

export async function getRoster(
  access: RequestAccess,
  rosterId: string,
): Promise<RosterDetail | null> {
  if (!parseRequestId(rosterId)) {
    return null;
  }

  const generatedBy = alias(user, "generated_by_user");
  const confirmedBy = alias(user, "confirmed_by_user");

  const [head] = await db
    .select({
      id: roster.id,
      requestId: roster.requestId,
      status: roster.status,
      generatedAt: roster.generatedAt,
      confirmedAt: roster.confirmedAt,
      updatedAt: roster.updatedAt,
      generatedByName: generatedBy.name,
      confirmedByName: confirmedBy.name,
      poNumber: rosterRequest.poNumber,
      type: rosterRequest.type,
      requestStatus: rosterRequest.status,
      startDate: rosterRequest.startDate,
      siteId: rosterRequest.siteId,
      locationId: rosterRequest.locationId,
      locationName: location.name,
      siteName: site.name,
    })
    .from(roster)
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .innerJoin(location, eq(location.id, rosterRequest.locationId))
    .innerJoin(site, eq(site.id, rosterRequest.siteId))
    .leftJoin(generatedBy, eq(generatedBy.id, roster.generatedBy))
    .leftJoin(confirmedBy, eq(confirmedBy.id, roster.confirmedBy))
    .where(and(eq(roster.id, rosterId), requestScopeFilter(access)));

  if (!head) {
    return null;
  }

  const type = head.type === "weekly" ? "weekly" : "daily";
  const days = requestDays(head.startDate, type);
  const lines = await loadRequestLines(db, head.requestId);

  const assignmentRows = (
    await db
      .select({
        lineId: rosterAssignment.requestLineId,
        workerId: rosterAssignment.workerId,
        employeeId: worker.employeeId,
        name: worker.name,
        endContract: worker.endContract,
        workDaysPerWeek: worker.workDaysPerWeek,
        date: rosterAssignment.workDate,
        kind: rosterAssignment.kind,
        shiftId: rosterAssignment.shiftId,
        shiftOrder: shift.order,
      })
      .from(rosterAssignment)
      .innerJoin(worker, eq(worker.id, rosterAssignment.workerId))
      .leftJoin(shift, eq(shift.id, rosterAssignment.shiftId))
      .where(eq(rosterAssignment.rosterId, rosterId))
  ).map((row) => ({ ...row, kind: row.kind as AssignmentKind }));

  const assignments: AssignmentRow[] = assignmentRows.map((row) => ({
    lineId: row.lineId,
    workerId: row.workerId,
    employeeId: row.employeeId,
    name: row.name,
    date: row.date,
    kind: row.kind,
    shiftOrder: row.shiftOrder,
  }));

  const conflicts: ConflictRow[] = (
    await db
      .select({
        lineId: rosterConflict.requestLineId,
        date: rosterConflict.workDate,
        shiftOrder: shift.order,
        shortfall: rosterConflict.shortfall,
        message: rosterConflict.message,
      })
      .from(rosterConflict)
      .leftJoin(shift, eq(shift.id, rosterConflict.shiftId))
      .where(eq(rosterConflict.rosterId, rosterId))
  ).map((row) => ({ ...row, shiftOrder: row.shiftOrder ?? null }));

  const edits = await db
    .select({ lineId: rosterEdit.requestLineId, workerId: rosterEdit.toWorkerId })
    .from(rosterEdit)
    .where(eq(rosterEdit.rosterId, rosterId));

  const cellEdits = await db
    .select({
      lineId: rosterCellEdit.requestLineId,
      workerId: rosterCellEdit.workerId,
      date: rosterCellEdit.workDate,
    })
    .from(rosterCellEdit)
    .where(eq(rosterCellEdit.rosterId, rosterId));

  // Warnings are not stored: they are worked out again from the roster as it stands.
  const workers = new Map(assignmentRows.map((row) => [row.workerId, row]));
  const workerIds = [...workers.keys()];
  const positions = await loadWorkerPositions(db, workerIds);

  const warnings = evaluateRoster({
    days,
    lines: lines.map((line) => ({
      id: line.lineId,
      positionId: line.positionId,
      positionName: line.positionName,
    })),
    workers: workerIds.map((id) => ({
      id,
      endContract: workers.get(id)?.endContract ?? "",
      positionIds: positions.get(id)?.ids ?? [],
      workDaysPerWeek: workers.get(id)?.workDaysPerWeek ?? null,
    })),
    cells: assignmentRows.map((row) => ({
      lineId: row.lineId,
      workerId: row.workerId,
      date: row.date,
      kind: row.kind,
      shiftOrder: row.shiftOrder,
      shiftId: row.shiftId,
    })),
    targets: await loadTargets(db, rosterId),
    rules: await loadEngineRules(db, { locationId: head.locationId, siteId: head.siteId }),
    history: await loadHistories(db, workerIds, days, rosterId),
  });

  const titles = new Map(lines.map((line) => [line.lineId, line.title]));
  const key = (entry: { lineId: string; workerId: string | null; date: string }) =>
    `${entry.lineId}|${entry.workerId}|${entry.date}`;

  const warningKeys = warningCellKeys(
    warnings,
    assignmentRows.map((row) => ({
      lineId: row.lineId,
      workerId: row.workerId,
      date: row.date,
      kind: row.kind,
      shiftOrder: row.shiftOrder,
      shiftId: row.shiftId,
    })),
  );

  return {
    id: head.id,
    requestId: head.requestId,
    poNumber: head.poNumber,
    type,
    startDate: head.startDate,
    locationName: head.locationName,
    siteName: head.siteName,
    status: head.status as RosterStatus,
    editable: isRosterEditable(head.status, head.requestStatus),
    generatedByName: head.generatedByName ?? null,
    generatedAt: head.generatedAt.toISOString(),
    confirmedByName: head.confirmedByName ?? null,
    confirmedAt: head.confirmedAt ? head.confirmedAt.toISOString() : null,
    version: head.updatedAt.toISOString(),
    days,
    shifts: await loadLocationShifts(db, head.locationId),
    lines: buildLineViews({
      days,
      lines,
      assignments,
      conflicts,
      replacedIn: edits,
      editedKeys: new Set(cellEdits.map(key)),
      warningKeys,
    }),
    conflicts: buildConflictViews(lines, conflicts),
    warnings: warnings.map((warning) => ({
      lineId: warning.lineId,
      lineTitle: titles.get(warning.lineId) ?? "",
      workerId: warning.workerId,
      workerName: warning.workerId === null ? null : (workers.get(warning.workerId)?.name ?? null),
      date: warning.date,
      message: warning.message,
    })),
    counts: rosterCounts(
      assignments,
      conflicts.length,
      edits.length + cellEdits.length,
      warnings.length,
    ),
  };
}

// The roster's per-shift targets, each with its shift's order.
async function loadTargets(reader: Reader, rosterId: string) {
  return reader
    .select({
      lineId: rosterShiftTarget.requestLineId,
      date: rosterShiftTarget.workDate,
      shiftId: rosterShiftTarget.shiftId,
      shiftOrder: shift.order,
      headcount: rosterShiftTarget.headcount,
    })
    .from(rosterShiftTarget)
    .innerJoin(shift, eq(shift.id, rosterShiftTarget.shiftId))
    .where(eq(rosterShiftTarget.rosterId, rosterId));
}

// The active shifts of a location by order, with their times as HH:mm. The Generate screen and the
// cell menu of the roster both list them.
async function loadLocationShifts(reader: Reader, locationId: string): Promise<GenerateShift[]> {
  const rows = await reader
    .select({
      id: shift.id,
      name: shift.name,
      order: shift.order,
      startTime: shift.startTime,
      endTime: shift.endTime,
    })
    .from(shift)
    .where(and(eq(shift.locationId, locationId), isNull(shift.deletedAt)))
    .orderBy(asc(shift.order));

  return rows.map((row) => ({
    ...row,
    startTime: toHourMinute(row.startTime),
    endTime: toHourMinute(row.endTime),
  }));
}

// The lines of the Generate screen. A line fixed to a shift gets its whole headcount on that shift,
// whatever a roster stored. An Any shift line starts from the stored split (a roster exists) or an
// even one. stored is keyed "lineId|date|shiftId", or null when the request has no roster.
export function buildGenerateLines(input: {
  days: string[];
  shiftIds: string[];
  lines: (LineHead & { shiftId: string | null })[];
  stored: Map<string, number> | null;
}): GenerateLine[] {
  const { days, shiftIds, stored } = input;

  return input.lines.map((line) => ({
    lineId: line.lineId,
    title: line.title,
    shiftLabel: line.shiftLabel,
    fixedShiftId: line.shiftId,
    required: line.perDay,
    split:
      line.shiftId !== null
        ? fixedSplit(
            days.map((_, dayIndex) => line.perDay[dayIndex] ?? 0),
            shiftIds,
            line.shiftId,
          )
        : days.map((date, dayIndex) =>
            stored
              ? shiftIds.map((shiftId) => stored.get(`${line.lineId}|${date}|${shiftId}`) ?? 0)
              : shiftIds.length === 0
                ? []
                : evenSplit(line.perDay[dayIndex] ?? 0, shiftIds),
          ),
  }));
}

// The Generate screen for an approved request. A draft starts from the split it was generated with,
// and a request with no roster starts from an even split.
export async function getGenerateView(
  access: RequestAccess,
  requestId: string,
): Promise<GenerateView | null> {
  if (!parseRequestId(requestId)) {
    return null;
  }

  const [request] = await db
    .select({
      id: rosterRequest.id,
      poNumber: rosterRequest.poNumber,
      type: rosterRequest.type,
      startDate: rosterRequest.startDate,
      siteId: rosterRequest.siteId,
      locationId: rosterRequest.locationId,
      locationName: location.name,
    })
    .from(rosterRequest)
    .innerJoin(location, eq(location.id, rosterRequest.locationId))
    .where(
      and(
        eq(rosterRequest.id, requestId),
        eq(rosterRequest.status, "approved"),
        requestScopeFilter(access),
      ),
    );

  if (!request) {
    return null;
  }

  const type = request.type === "weekly" ? "weekly" : "daily";
  const days = requestDays(request.startDate, type);

  const shifts = await loadLocationShifts(db, request.locationId);

  const lines = await loadRequestLines(db, request.id);

  const [existing] = await db
    .select({ id: roster.id, status: roster.status, updatedAt: roster.updatedAt })
    .from(roster)
    .where(eq(roster.requestId, request.id));

  const stored = new Map<string, number>();

  if (existing) {
    const targets = await db
      .select({
        lineId: rosterShiftTarget.requestLineId,
        date: rosterShiftTarget.workDate,
        shiftId: rosterShiftTarget.shiftId,
        headcount: rosterShiftTarget.headcount,
      })
      .from(rosterShiftTarget)
      .where(eq(rosterShiftTarget.rosterId, existing.id));

    for (const target of targets) {
      stored.set(`${target.lineId}|${target.date}|${target.shiftId}`, target.headcount);
    }
  }

  const shiftIds = shifts.map((row) => row.id);

  const generateLines = buildGenerateLines({
    days,
    shiftIds,
    lines,
    stored: existing ? stored : null,
  });

  return {
    requestId: request.id,
    poNumber: request.poNumber,
    type,
    startDate: request.startDate,
    locationName: request.locationName,
    days,
    shifts,
    lines: generateLines,
    existingRosterId: existing?.id ?? null,
    existingStatus: existing ? (existing.status as RosterStatus) : null,
    version: existing ? existing.updatedAt.toISOString() : null,
  };
}

// The three reads below look at other rosters. A roster whose request was cancelled stays on
// record, read-only, and must not block or count against anyone, so each one keeps to approved
// requests.

// The workers who work on one of the days in a roster of another request.
export function busyWorkersQuery(reader: Reader, requestId: string, firstDay: string, lastDay: string) {
  return reader
    .select({ id: rosterAssignment.workerId })
    .from(rosterAssignment)
    .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .where(
      and(
        ne(roster.requestId, requestId),
        eq(rosterRequest.status, "approved"),
        eq(rosterAssignment.kind, "work"),
        between(rosterAssignment.workDate, firstDay, lastDay),
      ),
    );
}

// The days the workers work in the other rosters of the same approved requests.
export function otherRosterWorkQuery(
  reader: Reader,
  rosterId: string,
  workerIds: string[],
  dates: string[],
) {
  return reader
    .select({ workerId: rosterAssignment.workerId, date: rosterAssignment.workDate })
    .from(rosterAssignment)
    .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .where(
      and(
        ne(rosterAssignment.rosterId, rosterId),
        eq(rosterRequest.status, "approved"),
        eq(rosterAssignment.kind, "work"),
        inArray(rosterAssignment.workerId, workerIds),
        inArray(rosterAssignment.workDate, dates),
      ),
    );
}

// The confirmed work rows of the workers between two dates. excludeRosterId leaves a roster out of
// its own history: a confirmed roster's rows are also its cells, and must not count twice.
export function confirmedWorkQuery(
  reader: Reader,
  workerIds: string[],
  from: string,
  to: string,
  excludeRosterId?: string,
) {
  return reader
    .select({
      workerId: rosterAssignment.workerId,
      date: rosterAssignment.workDate,
      shiftOrder: shift.order,
    })
    .from(rosterAssignment)
    .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .innerJoin(shift, eq(shift.id, rosterAssignment.shiftId))
    .where(
      and(
        eq(roster.status, "confirmed"),
        excludeRosterId ? ne(roster.id, excludeRosterId) : undefined,
        eq(rosterRequest.status, "approved"),
        eq(rosterAssignment.kind, "work"),
        inArray(rosterAssignment.workerId, workerIds),
        between(rosterAssignment.workDate, from, to),
      ),
    );
}

// The confirmed work rows of the workers in the window around a roster, grouped into histories.
// A caller reading an existing roster passes its id so the roster is not part of its own history.
async function loadHistories(
  reader: Reader,
  workerIds: string[],
  days: string[],
  excludeRosterId?: string,
): Promise<EngineHistory[]> {
  if (workerIds.length === 0 || days.length === 0) {
    return [];
  }

  const firstDay = days[0];
  const months = [...new Set(days.map(monthKey))];

  const rows = await confirmedWorkQuery(
    reader,
    workerIds,
    addDays(firstDay, -HISTORY_LOOKBACK_DAYS),
    addDays(days[days.length - 1], 31),
    excludeRosterId,
  );

  return workerIds.map((workerId) =>
    workerHistory(
      workerId,
      rows.filter((row) => row.workerId === workerId),
      firstDay,
      months,
    ),
  );
}

async function loadWorkerPositions(reader: Reader, workerIds: string[]) {
  const positions = new Map<string, { ids: string[]; names: string[] }>();

  if (workerIds.length === 0) {
    return positions;
  }

  const rows = await reader
    .select({ workerId: workerPosition.workerId, id: position.id, name: position.name })
    .from(workerPosition)
    .innerJoin(position, eq(position.id, workerPosition.positionId))
    .where(inArray(workerPosition.workerId, workerIds))
    .orderBy(asc(position.name), asc(position.id));

  for (const row of rows) {
    const entry = positions.get(row.workerId) ?? { ids: [], names: [] };

    entry.ids.push(row.id);
    entry.names.push(row.name);
    positions.set(row.workerId, entry);
  }

  return positions;
}

// Everything the engine reads from the database for one request. The targets are the user's split
// from the Generate screen, so the caller adds them. A worker who already works on one of these
// days in another roster is left out of the pool: the engine only knows its own roster.
export async function loadEngineInput(tx: Reader, requestId: string): Promise<LoadedEngineInput> {
  const [request] = await tx
    .select({
      type: rosterRequest.type,
      startDate: rosterRequest.startDate,
      siteId: rosterRequest.siteId,
      locationId: rosterRequest.locationId,
    })
    .from(rosterRequest)
    .where(eq(rosterRequest.id, requestId));

  if (!request) {
    throw new Error(`Request ${requestId} not found`);
  }

  const days = requestDays(request.startDate, request.type === "weekly" ? "weekly" : "daily");
  const lines = await loadRequestLines(tx, requestId);

  const shifts = await tx
    .select({ id: shift.id, order: shift.order })
    .from(shift)
    .where(and(eq(shift.locationId, request.locationId), isNull(shift.deletedAt)))
    .orderBy(asc(shift.order));

  const busy = busyWorkersQuery(tx, requestId, days[0], days[days.length - 1]);

  const workers = await tx
    .select({
      id: worker.id,
      employeeId: worker.employeeId,
      endContract: worker.endContract,
      workDaysPerWeek: worker.workDaysPerWeek,
    })
    .from(worker)
    .where(
      and(
        eq(worker.locationId, request.locationId),
        isNull(worker.deletedAt),
        notInArray(worker.id, busy),
      ),
    )
    .orderBy(asc(worker.employeeId), asc(worker.id));

  const workerIds = workers.map((row) => row.id);
  const positions = await loadWorkerPositions(tx, workerIds);
  const rules = await loadEngineRules(tx, {
    locationId: request.locationId,
    siteId: request.siteId,
  });

  return {
    input: {
      days,
      lines: lines.map((line) => ({ id: line.lineId, positionId: line.positionId })),
      shifts,
      workers: workers.map((row) => ({
        ...row,
        positionIds: positions.get(row.id)?.ids ?? [],
      })),
      rules,
      history: await loadHistories(tx, workerIds, days),
    },
    location: { id: request.locationId, siteId: request.siteId },
  };
}

// Loads what checkReplacement needs for a row and for each candidate. With candidateIds it loads
// just those workers, and a worker who is not an active worker of the location is dropped. Without
// it, it loads the pool: the active workers of the location who have the line's position when the
// rules require it and are not yet in the roster. Another roster's work days are read for every
// candidate. Draft and confirmed rosters both count.
export async function loadReplacementContext(
  reader: Reader,
  input: { rosterId: string; lineId: string; fromWorkerId: string; candidateIds: string[] | null },
): Promise<ReplacementContextResult> {
  const [head] = await reader
    .select({
      requestId: roster.requestId,
      siteId: rosterRequest.siteId,
      locationId: rosterRequest.locationId,
    })
    .from(roster)
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .where(eq(roster.id, input.rosterId));

  if (!head) {
    return { ok: false, reason: "line" };
  }

  const [line] = await reader
    .select({ positionId: rosterRequestLine.positionId, positionName: position.name })
    .from(rosterRequestLine)
    .innerJoin(position, eq(position.id, rosterRequestLine.positionId))
    .where(
      and(
        eq(rosterRequestLine.id, input.lineId),
        eq(rosterRequestLine.requestId, head.requestId),
      ),
    );

  const assignments = await reader
    .select({
      workerId: rosterAssignment.workerId,
      date: rosterAssignment.workDate,
      kind: rosterAssignment.kind,
      lineId: rosterAssignment.requestLineId,
      shiftOrder: shift.order,
    })
    .from(rosterAssignment)
    .leftJoin(shift, eq(shift.id, rosterAssignment.shiftId))
    .where(eq(rosterAssignment.rosterId, input.rosterId));

  // A line with no assignment in this roster is not part of it, even when the request has it.
  if (!line || !assignments.some((entry) => entry.lineId === input.lineId)) {
    return { ok: false, reason: "line" };
  }

  const row = assignments
    .filter((entry) => entry.lineId === input.lineId && entry.workerId === input.fromWorkerId)
    .sort((a, b) => byText(a.date, b.date))
    .map((entry) => ({
      date: entry.date,
      kind: entry.kind as AssignmentKind,
      shiftOrder: entry.kind === "work" ? (entry.shiftOrder ?? 0) : null,
    }));

  if (row.length === 0) {
    return { ok: false, reason: "worker" };
  }

  const rules = await loadEngineRules(reader, {
    locationId: head.locationId,
    siteId: head.siteId,
  });
  const inRoster = new Set(assignments.map((entry) => entry.workerId));

  const pool = await reader
    .select({
      id: worker.id,
      employeeId: worker.employeeId,
      name: worker.name,
      endContract: worker.endContract,
    })
    .from(worker)
    .where(
      and(
        eq(worker.locationId, head.locationId),
        isNull(worker.deletedAt),
        input.candidateIds ? inArray(worker.id, input.candidateIds) : undefined,
      ),
    )
    .orderBy(asc(worker.employeeId), asc(worker.id));

  const positions = await loadWorkerPositions(
    reader,
    pool.map((entry) => entry.id),
  );

  const eligible = pool.filter(
    (entry) =>
      input.candidateIds !== null ||
      (!inRoster.has(entry.id) &&
        (!rules.requirePositionMatch || positions.get(entry.id)?.ids.includes(line.positionId))),
  );

  const eligibleIds = eligible.map((entry) => entry.id);
  const days = row.map((entry) => entry.date);

  const others =
    eligibleIds.length === 0
      ? []
      : await otherRosterWorkQuery(reader, input.rosterId, eligibleIds, days);

  const histories = await loadHistories(reader, eligibleIds, days, input.rosterId);

  return {
    ok: true,
    context: {
      row,
      position: { id: line.positionId, name: line.positionName },
      rules,
      candidates: eligible.map((entry, index) => ({
        id: entry.id,
        employeeId: entry.employeeId,
        name: entry.name,
        endContract: entry.endContract,
        positionIds: positions.get(entry.id)?.ids ?? [],
        positionNames: positions.get(entry.id)?.names ?? [],
        alreadyInRoster: inRoster.has(entry.id),
        otherRosterWorkDates: others
          .filter((other) => other.workerId === entry.id)
          .map((other) => other.date),
        history: histories[index],
      })),
    },
  };
}

// The active workers of a location by employee ID, each with the names of their positions. The pool
// the Add worker dialog and the cell candidate list choose from.
export async function loadLocationWorkers(
  reader: Reader,
  locationId: string,
): Promise<LocationWorker[]> {
  const rows = await reader
    .select({ id: worker.id, employeeId: worker.employeeId, name: worker.name })
    .from(worker)
    .where(and(eq(worker.locationId, locationId), isNull(worker.deletedAt)))
    .orderBy(asc(worker.employeeId), asc(worker.id));

  const positions = await loadWorkerPositions(
    reader,
    rows.map((row) => row.id),
  );

  return rows.map((row) => ({ ...row, positionNames: positions.get(row.id)?.names ?? [] }));
}

// Loads what a cell edit is judged and stored with: the whole roster as it stands, and the listed
// workers, who may or may not be in it yet. A listed worker who is not an active worker of the
// location gives reason "worker". Another roster's work days count for draft and confirmed rosters.
export async function loadCellContext(
  reader: Reader,
  input: { rosterId: string; lineId: string; workerIds: string[] },
): Promise<CellContextResult> {
  const [head] = await reader
    .select({
      requestId: roster.requestId,
      type: rosterRequest.type,
      startDate: rosterRequest.startDate,
      siteId: rosterRequest.siteId,
      locationId: rosterRequest.locationId,
    })
    .from(roster)
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .where(eq(roster.id, input.rosterId));

  if (!head) {
    return { ok: false, reason: "line" };
  }

  const lines = (await loadRequestLines(reader, head.requestId)).map((line) => ({
    id: line.lineId,
    positionId: line.positionId,
    positionName: line.positionName,
  }));

  const line = lines.find((entry) => entry.id === input.lineId);

  if (!line) {
    return { ok: false, reason: "line" };
  }

  const workerIds = [...new Set(input.workerIds)];

  const workers =
    workerIds.length === 0
      ? []
      : await reader
          .select({
            id: worker.id,
            employeeId: worker.employeeId,
            name: worker.name,
            endContract: worker.endContract,
            workDaysPerWeek: worker.workDaysPerWeek,
          })
          .from(worker)
          .where(
            and(
              inArray(worker.id, workerIds),
              eq(worker.locationId, head.locationId),
              isNull(worker.deletedAt),
            ),
          )
          .orderBy(asc(worker.employeeId), asc(worker.id));

  if (workers.length !== workerIds.length) {
    return { ok: false, reason: "worker" };
  }

  const days = requestDays(head.startDate, head.type === "weekly" ? "weekly" : "daily");

  const shifts = await reader
    .select({ id: shift.id, order: shift.order })
    .from(shift)
    .where(and(eq(shift.locationId, head.locationId), isNull(shift.deletedAt)))
    .orderBy(asc(shift.order));

  const cells = (
    await reader
      .select({
        lineId: rosterAssignment.requestLineId,
        workerId: rosterAssignment.workerId,
        date: rosterAssignment.workDate,
        kind: rosterAssignment.kind,
        shiftOrder: shift.order,
        shiftId: rosterAssignment.shiftId,
      })
      .from(rosterAssignment)
      .leftJoin(shift, eq(shift.id, rosterAssignment.shiftId))
      .where(eq(rosterAssignment.rosterId, input.rosterId))
  ).map((row) => ({ ...row, kind: row.kind as AssignmentKind }));

  const previousConflicts = await reader
    .select({
      lineId: rosterConflict.requestLineId,
      date: rosterConflict.workDate,
      shiftId: rosterConflict.shiftId,
      shortfall: rosterConflict.shortfall,
      message: rosterConflict.message,
    })
    .from(rosterConflict)
    .where(eq(rosterConflict.rosterId, input.rosterId));

  const positions = await loadWorkerPositions(reader, workerIds);

  return {
    ok: true,
    context: {
      dates: days,
      shifts,
      line,
      workers: workers.map((entry) => ({
        ...entry,
        positionIds: positions.get(entry.id)?.ids ?? [],
        positionNames: positions.get(entry.id)?.names ?? [],
        active: true,
      })),
      cells,
      targets: await loadTargets(reader, input.rosterId),
      busy:
        workerIds.length === 0
          ? []
          : await otherRosterWorkQuery(reader, input.rosterId, workerIds, days),
      history: await loadHistories(reader, workerIds, days, input.rosterId),
      rules: await loadEngineRules(reader, { locationId: head.locationId, siteId: head.siteId }),
      previousConflicts,
      lines,
    },
  };
}

// The workers who could take over a row, each with the rules they would break. An empty reasons
// list means the worker is eligible. A roster, line, or worker outside the actor's scope gives an
// empty list, the same as one that does not exist.
export async function replacementCandidates(
  access: RequestAccess,
  rosterId: string,
  lineId: string,
  fromWorkerId: string,
): Promise<ReplacementCandidate[]> {
  if (!parseRequestId(rosterId) || !parseRequestId(lineId) || !parseRequestId(fromWorkerId)) {
    return [];
  }

  const [visible] = await db
    .select({ id: roster.id })
    .from(roster)
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .where(and(eq(roster.id, rosterId), requestScopeFilter(access)));

  if (!visible) {
    return [];
  }

  const loaded = await loadReplacementContext(db, {
    rosterId,
    lineId,
    fromWorkerId,
    candidateIds: null,
  });

  if (!loaded.ok) {
    return [];
  }

  const { context } = loaded;

  return context.candidates.map((candidate) => {
    const input = {
      row: context.row,
      candidate: {
        id: candidate.id,
        endContract: candidate.endContract,
        positionIds: candidate.positionIds,
      },
      position: context.position,
      alreadyInRoster: candidate.alreadyInRoster,
      otherRosterWorkDates: candidate.otherRosterWorkDates,
      history: candidate.history,
      rules: context.rules,
    };
    const result = checkReplacement(input);

    return {
      workerId: candidate.id,
      employeeId: candidate.employeeId,
      name: candidate.name,
      positionNames: candidate.positionNames,
      reasons: result.ok ? [] : result.reasons,
      hard: checkReplacementDetailed(input).hard.length > 0,
    };
  });
}
