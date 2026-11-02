import { z } from "zod";

const requestIdSchema = z.string().uuid();

// Reads the request id from the URL. Anything that is not a uuid gives null.
export function parseRequestId(value: string): string | null {
  const result = requestIdSchema.safeParse(value);

  return result.success ? result.data : null;
}
