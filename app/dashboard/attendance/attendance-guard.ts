import "server-only";
import { notFound } from "next/navigation";
import { findLocationSiteId } from "@/app/dashboard/positions/positions";
import { requireUser } from "@/lib/session";
import type { AttendanceAccess } from "@/types/attendance";
import { attendanceAccessFor } from "./attendance-access";

// Attendance pages and actions: superadmin, HO, and admin site. Other roles get notFound(), like
// requireWorkerAccess. An admin site user is scoped by location, so its site is read from that
// location.
export async function requireAttendanceAccess(): Promise<AttendanceAccess> {
  const user = await requireUser();
  const locationSiteId =
    user.role === "admin_site" && user.locationId
      ? await findLocationSiteId(user.locationId)
      : null;
  const access = attendanceAccessFor(user, locationSiteId);

  if (!access) {
    notFound();
  }

  return access;
}
