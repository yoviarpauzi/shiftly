import { z } from "zod";

const departmentIdSchema = z.string().uuid();

// Reads the department id from the URL. Anything that is not a uuid gives null.
export function parseDepartmentId(value: string): string | null {
  const result = departmentIdSchema.safeParse(value);

  return result.success ? result.data : null;
}
