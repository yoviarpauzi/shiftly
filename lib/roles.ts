import type { AppRole } from "@/types/roles";

export const ALLOWED_ROLES = ["ho", "admin_site"] as const satisfies readonly AppRole[];

export const ROLE_LABELS: Record<AppRole, string> = {
  ho: "HO",
  admin_site: "Admin site",
};

export function isAllowedRole(role: unknown): role is AppRole {
  return typeof role === "string" && (ALLOWED_ROLES as readonly string[]).includes(role);
}
