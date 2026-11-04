import { z } from "zod";

import type { AttendanceFilters, AttendanceStatus } from "@/types/attendance";

import { isCalendarDate } from "./calendar-date";

export const ATTENDANCE_STATUS_VALUES = ["present", "absent", "sick", "leave"] as const;

export const REASON_MAX_LENGTH = 200;

const MAX_ENTRIES = 500;
const MAX_QUERY_LENGTH = 100;

// Trimmed first, so the length check counts what is stored. A blank reason is stored as no reason.
const reasonField = z
  .string({ error: "Reason must be text" })
  .nullable()
  .transform((value) => {
    const trimmed = value === null ? "" : value.trim();

    return trimmed === "" ? null : trimmed;
  })
  .pipe(
    z
      .string()
      .max(REASON_MAX_LENGTH, `Reason must be ${REASON_MAX_LENGTH} characters or fewer`)
      .nullable(),
  );

const entrySchema = z
  .object({
    assignmentId: z.string({ error: "Choose a worker" }).uuid("Choose a worker"),
    status: z.enum(ATTENDANCE_STATUS_VALUES, { error: "Choose a status" }).nullable(),
    reason: reasonField,
  })
  .superRefine((entry, ctx) => {
    if (entry.status === null && entry.reason !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Choose a status before adding a reason",
      });
    }
  });

const entriesField = z
  .array(entrySchema, { error: "Nothing to save" })
  .min(1, "Nothing to save")
  .max(MAX_ENTRIES, "Too many changes at once")
  .superRefine((entries, ctx) => {
    const seen = new Set<string>();

    entries.forEach((entry, index) => {
      if (seen.has(entry.assignmentId)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "assignmentId"],
          message: "Each worker can appear only once",
        });
      }
      seen.add(entry.assignmentId);
    });
  });

export const saveAttendanceSchema = z.object({
  date: z
    .string({ error: "Date is required" })
    .refine(isCalendarDate, "Date must be a real date like 2026-11-09"),
  entries: entriesField,
});

export type SaveAttendanceInput = z.infer<typeof saveAttendanceSchema>;

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function uuidOrNull(value: string | string[] | undefined): string | null {
  const first = firstValue(value);

  return z.string().uuid().safeParse(first).success ? first : null;
}

function statusOrAll(value: string | string[] | undefined): AttendanceFilters["status"] {
  const first = firstValue(value);

  if (first === "not-marked") {
    return first;
  }

  return (ATTENDANCE_STATUS_VALUES as readonly string[]).includes(first)
    ? (first as AttendanceStatus)
    : "all";
}

// Reads the Attendance filters from the URL. Anything unknown falls back to its default, so a
// bad link shows today and every worker instead of an error.
export function parseAttendanceFilters(params: SearchParams, today: string): AttendanceFilters {
  const date = firstValue(params.date);

  return {
    date: isCalendarDate(date) ? date : today,
    siteId: uuidOrNull(params.site),
    locationId: uuidOrNull(params.location),
    departmentId: uuidOrNull(params.department),
    shiftId: uuidOrNull(params.shift),
    status: statusOrAll(params.status),
    query: firstValue(params.q).trim().slice(0, MAX_QUERY_LENGTH),
  };
}
