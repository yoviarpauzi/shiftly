import type { AppRole } from "@/types/roles";

export const ALLOWED_ROLES = ["superadmin", "ho", "admin_site"] as const satisfies readonly AppRole[];

export function isAllowedRole(role: unknown): role is AppRole {
  return typeof role === "string" && (ALLOWED_ROLES as readonly string[]).includes(role);
}
