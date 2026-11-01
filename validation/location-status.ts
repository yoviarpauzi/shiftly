import type { LocationStatus } from "@/types/locations";

export const LOCATION_STATUSES = ["active", "deleted", "all"] as const satisfies readonly LocationStatus[];

// Reads the status filter from the URL. Anything missing or unknown shows all locations.
export function parseLocationStatus(value: string | string[] | undefined): LocationStatus {
  const first = Array.isArray(value) ? value[0] : value;

  return (LOCATION_STATUSES as readonly string[]).includes(first ?? "")
    ? (first as LocationStatus)
    : "all";
}
