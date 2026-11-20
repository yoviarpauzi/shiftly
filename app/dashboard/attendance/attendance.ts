import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { toHourMinute } from "@/app/dashboard/shifts/shift-rules";
import { attendance } from "@/database/schema/attendance-schema";
import { department } from "@/database/schema/department-schema";
import { location } from "@/database/schema/location-schema";
import { position } from "@/database/schema/position-schema";
import { rosterRequest, rosterRequestLine } from "@/database/schema/request-schema";
import { roster, rosterAssignment } from "@/database/schema/roster-schema";
import { shift } from "@/database/schema/shift-schema";
import { worker } from "@/database/schema/worker-schema";
import { db } from "@/lib/db";
import { dateInZone } from "@/lib/indonesia-date";
import type {
  AttendanceAccess,
  AttendanceChoices,
  AttendanceFilters,
  AttendanceJoinedRow,
  AttendanceListResult,
  AttendanceRow,
  AttendanceStatus,
} from "@/types/attendance";
import { DEFAULT_LOCATION_TIMEZONE, locationTimezoneSchema } from "@/validation/location";
import { attendanceScope } from "./attendance-access";
import { isFutureDay, summarize } from "./attendance-rules";

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// The location the page shows. Null means All. A value that is not allowed becomes All, and a list
// with only one location is that location, so nobody is left on All when there is nothing to choose
// between.
export function resolveSelection(
  locations: { id: string }[],
  locationId: string | null,
): string | null {
  const chosen =
    locations.find((entry) => entry.id === locationId) ??
    (locations.length === 1 ? locations[0] : null);

  return chosen?.id ?? null;
}

// The filters apply to the rows, and the summary does not: it counts every worker of the date and
// location, so the cards stay put while a filter changes. Rows are ordered by department, shift
// order, then worker name.
export function buildAttendanceList(
  joined: AttendanceJoinedRow[],
  filters: AttendanceFilters,
): { rows: AttendanceRow[]; summary: AttendanceListResult["summary"] } {
  const entries = joined.map(({ departmentId, shiftId, ...rest }) => ({
    departmentId,
    shiftId,
    row: {
      ...rest,
      status: rest.status as AttendanceStatus | null,
      startTime: toHourMinute(rest.startTime),
      endTime: toHourMinute(rest.endTime),
    } satisfies AttendanceRow,
  }));
  const all = entries.map((entry) => entry.row);

  const needle = filters.query.toLowerCase();

  const rows = entries
    .filter(
      (entry) =>
        (!filters.departmentId || entry.departmentId === filters.departmentId) &&
        (!filters.shiftId || entry.shiftId === filters.shiftId),
    )
    .map((entry) => entry.row)
    .filter((row) => {
      if (filters.status === "all") return true;
      if (filters.status === "not-marked") return row.status === null;

      return row.status === filters.status;
    })
    .filter(
      (row) =>
        !needle ||
        row.workerName.toLowerCase().includes(needle) ||
        row.employeeId.toLowerCase().includes(needle),
    )
    .sort(
      (a, b) =>
        byText(a.departmentName.toLowerCase(), b.departmentName.toLowerCase()) ||
        a.shiftOrder - b.shiftOrder ||
        byText(a.workerName.toLowerCase(), b.workerName.toLowerCase()) ||
        byText(a.assignmentId, b.assignmentId),
    );

  return { rows, summary: summarize(all) };
}

// The locations, departments, and shifts the Attendance filters offer to this access, and the
// location they resolved to. HO sees every active location and admin site its own.
export async function attendanceChoicesFor(
  access: AttendanceAccess,
  requestedLocationId: string | null,
): Promise<AttendanceChoices> {
  const locations = await db
    .select({ id: location.id, name: location.name, timezone: location.timezone })
    .from(location)
    .where(
      and(
        isNull(location.deletedAt),
        access.locationId ? eq(location.id, access.locationId) : undefined,
      ),
    )
    .orderBy(asc(location.name), asc(location.id));

  const locationId = resolveSelection(locations, requestedLocationId);

  const departments = locationId
    ? await db
        .select({ id: department.id, name: department.name })
        .from(department)
        .where(and(eq(department.locationId, locationId), isNull(department.deletedAt)))
        .orderBy(asc(department.name), asc(department.id))
    : [];

  const shifts = locationId
    ? await db
        .select({ id: shift.id, name: shift.name })
        .from(shift)
        .where(and(eq(shift.locationId, locationId), isNull(shift.deletedAt)))
        .orderBy(asc(shift.order), asc(shift.id))
    : [];

  return { locationId, locations, departments, shifts };
}

// The work assignments of the filter's date in confirmed rosters of the locations in scope, whose
// request is still approved, each with its attendance row if there is one. The scope is the chosen
// location, else everything the access allows. A worker or department deleted
// after the roster was confirmed stays in the list: the day happened.
export async function listAttendance(
  access: AttendanceAccess,
  filters: AttendanceFilters,
  choices: AttendanceChoices,
): Promise<AttendanceListResult> {
  // Today follows the chosen location. While the location is All the list is only viewed, so the
  // default zone is enough.
  const chosen = choices.locations.find((entry) => entry.id === choices.locationId);
  const zone = locationTimezoneSchema.safeParse(chosen?.timezone);
  const today = dateInZone(zone.success ? zone.data : DEFAULT_LOCATION_TIMEZONE);
  const scope = attendanceScope(access, choices);

  if (scope.length === 0) {
    return {
      rows: [],
      summary: summarize([]),
      today,
      isFuture: isFutureDay(filters.date, today),
    };
  }

  const joined = await db
    .select({
      assignmentId: rosterAssignment.id,
      employeeId: worker.employeeId,
      workerName: worker.name,
      departmentId: department.id,
      departmentName: department.name,
      positionName: position.name,
      locationName: location.name,
      shiftId: shift.id,
      shiftOrder: shift.order,
      shiftName: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      status: attendance.status,
      reason: attendance.reason,
    })
    .from(rosterAssignment)
    .innerJoin(roster, eq(roster.id, rosterAssignment.rosterId))
    .innerJoin(rosterRequest, eq(rosterRequest.id, roster.requestId))
    .innerJoin(location, eq(location.id, rosterRequest.locationId))
    .innerJoin(worker, eq(worker.id, rosterAssignment.workerId))
    .innerJoin(rosterRequestLine, eq(rosterRequestLine.id, rosterAssignment.requestLineId))
    .innerJoin(department, eq(department.id, rosterRequestLine.departmentId))
    .innerJoin(position, eq(position.id, rosterRequestLine.positionId))
    .innerJoin(shift, eq(shift.id, rosterAssignment.shiftId))
    .leftJoin(attendance, eq(attendance.rosterAssignmentId, rosterAssignment.id))
    .where(
      and(
        eq(rosterAssignment.workDate, filters.date),
        eq(rosterAssignment.kind, "work"),
        eq(roster.status, "confirmed"),
        eq(rosterRequest.status, "approved"),
        inArray(rosterRequest.locationId, scope),
      ),
    );

  return {
    ...buildAttendanceList(joined, filters),
    today,
    isFuture: isFutureDay(filters.date, today),
  };
}
