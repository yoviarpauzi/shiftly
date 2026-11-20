import type { AppRole } from "@/types/roles";
import type { ManagedTarget, UserAccess, UserScope } from "@/types/users";

export type { ManagedTarget };

// Only HO manages users, and only an HO without a location of its own. Anyone else gets null.
// Kept free of server-only so the rule can be tested directly.
export function userAccessFor(user: UserScope): UserAccess | null {
  if (user.role === "ho" && !user.locationId) {
    return { id: user.id, role: "ho" };
  }

  return null;
}

// Both roles are open to every HO. The access stays a parameter so a narrower rule can return later.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function assignableRoles(access: UserAccess): AppRole[] {
  return ["ho", "admin_site"];
}

// Every HO manages every user. The parameters stay so a narrower rule can return later.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function canManageUser(access: UserAccess, target: ManagedTarget): boolean {
  return true;
}
