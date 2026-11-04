import type { AttendanceAccess } from "@/types/attendance";
import type { UserScope } from "@/types/users";

// Superadmin sees every location. HO sees the locations of its own site. Admin site sees its own
// location, so the caller passes the site that holds that location. Anyone else gets null. This is
// the same scope as the Roster menu.
// Kept free of server-only so the rule can be tested directly.
export function attendanceAccessFor(
  user: UserScope,
  locationSiteId: string | null,
): AttendanceAccess | null {
  if (user.role === "superadmin") {
    return { userId: user.id, role: "superadmin", siteId: null, locationId: null };
  }

  if (user.role === "ho" && user.siteId && !user.locationId) {
    return { userId: user.id, role: "ho", siteId: user.siteId, locationId: null };
  }

  if (user.role === "admin_site" && user.locationId && locationSiteId) {
    return {
      userId: user.id,
      role: "admin_site",
      siteId: locationSiteId,
      locationId: user.locationId,
    };
  }

  return null;
}

// The only check for a location's attendance. Callers load the location row first, then ask this.
export function canAccessAttendanceLocation(
  access: AttendanceAccess,
  location: { id: string; siteId: string },
): boolean {
  const siteOk = access.siteId === null || access.siteId === location.siteId;
  const locationOk = access.locationId === null || access.locationId === location.id;

  return siteOk && locationOk;
}
