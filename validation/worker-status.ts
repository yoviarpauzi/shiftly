import type { WorkerStatus } from "@/types/workers";

export const WORKER_STATUSES = ["active", "deleted", "all"] as const satisfies readonly WorkerStatus[];

// Reads the status filter from the URL. Anything missing or unknown shows all workers.
export function parseWorkerStatus(value: string | string[] | undefined): WorkerStatus {
  const first = Array.isArray(value) ? value[0] : value;

  return (WORKER_STATUSES as readonly string[]).includes(first ?? "")
    ? (first as WorkerStatus)
    : "all";
}
