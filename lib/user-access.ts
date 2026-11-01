import type { AppRole } from "@/types/roles";
import type { ManagedTarget, UserAccess, UserScope } from "@/types/users";

export type { ManagedTarget };

// Superadmin manages every site. HO manages its own site and nothing else. Anyone else gets null.
// Kept free of server-only so the rule can be tested directly.
export function userAccessFor(user: UserScope): UserAccess | null {
  if (user.role === "superadmin") {
    return { id: user.id, role: "superadmin", siteId: null };
  }

  if (user.role === "ho" && user.siteId && !user.locationId) {
    return { id: user.id, role: "ho", siteId: user.siteId };
  }

  return null;
}

export function assignableRoles(access: UserAccess): AppRole[] {
  return access.role === "superadmin" ? ["superadmin", "ho", "admin_site"] : ["admin_site"];
}

// HO manages only admin site users whose location belongs to HO's site.
export function canManageUser(access: UserAccess, target: ManagedTarget): boolean {
  if (access.role === "superadmin") return true;
  return (
    access.siteId !== null &&
    target.role === "admin_site" &&
    target.locationSiteId === access.siteId
  );
}

export function canAssign(
  access: UserAccess,
  change: { role: AppRole },
  locationSiteId: string | null,
): boolean {
  if (access.role === "superadmin") return true;
  return (
    access.siteId !== null && change.role === "admin_site" && locationSiteId === access.siteId
  );
}
