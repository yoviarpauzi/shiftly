import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import type { AttendanceAccess } from "@/types/attendance";
import { attendanceAccessFor } from "./attendance-access";

// Attendance pages and actions: HO and admin site. Other roles get notFound(), like
// requireWorkerAccess.
export async function requireAttendanceAccess(): Promise<AttendanceAccess> {
  const user = await requireUser();
  const access = attendanceAccessFor(user);

  if (!access) {
    notFound();
  }

  return access;
}
