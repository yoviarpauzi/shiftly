import type { UserStatusFilter } from "@/types/users";

const USER_STATUSES = ["active", "banned", "all"] as const satisfies readonly UserStatusFilter[];

// Reads the status filter from the URL. Anything missing or unknown shows all users.
export function parseUserStatus(value: string | string[] | undefined): UserStatusFilter {
  const first = Array.isArray(value) ? value[0] : value;

  return (USER_STATUSES as readonly string[]).includes(first ?? "")
    ? (first as UserStatusFilter)
    : "all";
}
