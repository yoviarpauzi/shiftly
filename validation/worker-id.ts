import { z } from "zod";

const workerIdSchema = z.string().uuid();

// Reads the worker id from the URL. Anything that is not a uuid gives null.
export function parseWorkerId(value: string): string | null {
  const result = workerIdSchema.safeParse(value);

  return result.success ? result.data : null;
}
