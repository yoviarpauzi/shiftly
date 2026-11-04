import { AttendanceEmpty } from "@/components/dashboard/attendance/attendance-empty";
import { AttendanceFilters } from "@/components/dashboard/attendance/attendance-filters";
import { AttendanceForm } from "@/components/dashboard/attendance/attendance-form";
import { AttendanceSummary } from "@/components/dashboard/attendance/attendance-summary";
import { dateInZone } from "@/lib/indonesia-date";
import { parseAttendanceFilters } from "@/validation/attendance";
import { DEFAULT_LOCATION_TIMEZONE } from "@/validation/location";
import { requireAttendanceAccess } from "./attendance-guard";
import { attendanceFormKey, attendanceLock, locationViewFor } from "./attendance-rules";
import { attendanceChoicesFor, listAttendance } from "./attendance";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireAttendanceAccess();
  const params = await searchParams;

  // The date defaults to today in the location's zone, and the location comes from the choices, so
  // the site and location are read first with a stand-in date.
  const asked = parseAttendanceFilters(params, dateInZone(DEFAULT_LOCATION_TIMEZONE));
  const choices = await attendanceChoicesFor(access, asked.siteId, asked.locationId);
  const chosen = choices.locations.find((entry) => entry.id === choices.locationId);
  const today = dateInZone(chosen?.timezone ?? DEFAULT_LOCATION_TIMEZONE);

  const parsed = parseAttendanceFilters(params, today);
  // A department or shift that is not one of this location's choices is ignored.
  const filters = {
    ...parsed,
    siteId: choices.siteId,
    locationId: choices.locationId,
    departmentId: choices.departments.some((entry) => entry.id === parsed.departmentId)
      ? parsed.departmentId
      : null,
    shiftId: choices.shifts.some((entry) => entry.id === parsed.shiftId) ? parsed.shiftId : null,
  };

  const list = await listAttendance(access, filters, choices);
  const filtered =
    filters.status !== "all" || filters.query !== "" || filters.departmentId || filters.shiftId;

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Mark who came to work each day. Only workers scheduled in a confirmed roster appear.
        </p>
      </div>
      <AttendanceForm
        date={filters.date}
        today={list.today}
        rows={list.rows}
        resetKey={attendanceFormKey(filters.date, choices.locationId, list.rows)}
        lock={attendanceLock(choices.locationId, list.isFuture)}
        locationView={locationViewFor(choices)}
        filters={<AttendanceFilters filters={filters} choices={choices} />}
        // The Figma frame for a day with no roster has no counts, since they would all be zero.
        summary={list.summary.scheduled > 0 ? <AttendanceSummary summary={list.summary} /> : null}
        empty={
          filtered && list.summary.scheduled > 0 ? (
            <p className="rounded-lg border px-4 py-12 text-center text-sm text-muted-foreground">
              No workers match these filters
            </p>
          ) : (
            <AttendanceEmpty locationName={chosen?.name ?? "these locations"} />
          )
        }
      />
    </div>
  );
}
