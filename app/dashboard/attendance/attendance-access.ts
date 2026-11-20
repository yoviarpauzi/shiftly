import type { AttendanceAccess, AttendanceChoices } from "@/types/attendance";
import type { UserScope } from "@/types/users";

// HO sees every location. Admin site sees its own location. Anyone else gets null, including an HO
// that carries a location and an admin site without one. This is the same scope as the Roster menu.
// Kept free of server-only so the rule can be tested directly.
export function attendanceAccessFor(user: UserScope): AttendanceAccess | null {
  if (user.role === "ho" && !user.locationId) {
    return { userId: user.id, role: "ho", locationId: null };
  }

  if (user.role === "admin_site" && user.locationId) {
    return { userId: user.id, role: "admin_site", locationId: user.locationId };
  }

  return null;
}

// The only check for a location's attendance. Callers load the location row first, then ask this.
export function canAccessAttendanceLocation(
  access: AttendanceAccess,
  location: { id: string },
): boolean {
  return access.locationId === null || access.locationId === location.id;
}

// The locations a list may read: the chosen location, else every location in the choices. Each one
// still has to pass canAccessAttendanceLocation, so a list or a URL that names a place outside the
// access gives nothing.
export function attendanceScope(
  access: AttendanceAccess,
  choices: Pick<AttendanceChoices, "locationId" | "locations">,
): string[] {
  return choices.locations
    .filter(
      (entry) =>
        (choices.locationId === null || entry.id === choices.locationId) &&
        canAccessAttendanceLocation(access, entry),
    )
    .map((entry) => entry.id);
}
