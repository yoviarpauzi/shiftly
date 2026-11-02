import type { ShiftStatus } from "@/types/shifts";

export const SHIFT_STATUSES = ["active", "deleted", "all"] as const satisfies readonly ShiftStatus[];

// Reads the status filter from the URL. Anything missing or unknown shows all shifts.
export function parseShiftStatus(value: string | string[] | undefined): ShiftStatus {
  const first = Array.isArray(value) ? value[0] : value;

  return (SHIFT_STATUSES as readonly string[]).includes(first ?? "")
    ? (first as ShiftStatus)
    : "all";
}
