import type { WorkerFormOption } from "@/types/workers";

// Reads the location filter from the URL. Only ids from the choices count, so anything else shows every location.
export function parseWorkerLocation(
  value: string | string[] | undefined,
  locations: WorkerFormOption[],
): string | null {
  const first = Array.isArray(value) ? value[0] : value;

  return locations.some((location) => location.id === first) ? (first as string) : null;
}
