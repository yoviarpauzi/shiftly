import type { WorkerFormOption } from "@/types/workers";

// Reads the position filter from the URL. Only ids from the choices count, so anything else shows every position.
export function parseWorkerPosition(
  value: string | string[] | undefined,
  positions: WorkerFormOption[],
): string | null {
  const first = Array.isArray(value) ? value[0] : value;

  return positions.some((position) => position.id === first) ? (first as string) : null;
}
