import type { DepartmentStatus } from "@/types/departments";

export const DEPARTMENT_STATUSES = ["active", "deleted", "all"] as const satisfies readonly DepartmentStatus[];

// Reads the status filter from the URL. Anything missing or unknown shows all departments.
export function parseDepartmentStatus(value: string | string[] | undefined): DepartmentStatus {
  const first = Array.isArray(value) ? value[0] : value;

  return (DEPARTMENT_STATUSES as readonly string[]).includes(first ?? "")
    ? (first as DepartmentStatus)
    : "all";
}
