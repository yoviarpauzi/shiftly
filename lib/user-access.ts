import type { UserAccess, UserScope } from "@/types/users";

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
