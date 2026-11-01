import type { UserRoleFilter } from "@/types/users";

const USER_ROLES = ["superadmin", "ho", "admin_site", "all"] as const satisfies readonly UserRoleFilter[];

// Reads the role filter from the URL. Anything missing or unknown shows all users.
export function parseUserRole(value: string | string[] | undefined): UserRoleFilter {
  const first = Array.isArray(value) ? value[0] : value;

  return (USER_ROLES as readonly string[]).includes(first ?? "")
    ? (first as UserRoleFilter)
    : "all";
}
