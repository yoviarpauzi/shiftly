import type { PositionStatus } from "@/types/positions";

export const POSITION_STATUSES = ["active", "deleted", "all"] as const satisfies readonly PositionStatus[];

// Reads the status filter from the URL. Anything missing or unknown shows all positions.
export function parsePositionStatus(value: string | string[] | undefined): PositionStatus {
  const first = Array.isArray(value) ? value[0] : value;

  return (POSITION_STATUSES as readonly string[]).includes(first ?? "")
    ? (first as PositionStatus)
    : "all";
}
