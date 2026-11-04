import { z } from "zod";

import type { RosterFilters, RosterStatusFilter } from "@/types/rosters";

import { isCalendarDate } from "./calendar-date";

const MAX_QUERY_LENGTH = 100;
const HEADCOUNT_MESSAGE = "Headcount must be a whole number from 0 to 999";

const targetSchema = z.object({
  lineId: z.string({ error: "Choose a line" }).uuid("Choose a line"),
  date: z
    .string({ error: "Date is required" })
    .refine(isCalendarDate, "Date must be a real date like 2026-11-09"),
  shiftId: z.string({ error: "Choose a shift" }).uuid("Choose a shift"),
  headcount: z
    .number({ error: HEADCOUNT_MESSAGE })
    .int(HEADCOUNT_MESSAGE)
    .min(0, HEADCOUNT_MESSAGE)
    .max(999, HEADCOUNT_MESSAGE),
});

const targetsField = z
  .array(targetSchema, { error: "Nothing to generate" })
  .min(1, "Nothing to generate")
  .superRefine((targets, ctx) => {
    const seen = new Set<string>();

    targets.forEach((target, index) => {
      const key = JSON.stringify([target.lineId, target.date, target.shiftId]);

      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "shiftId"],
          message: "Each shift can appear only once per day",
        });
      }
      seen.add(key);
    });
  });

// version is the roster's updatedAt as ISO text when generating again, and null for a first
// generate.
export const generateRosterSchema = z.object({
  requestId: z.string({ error: "Choose a request" }).uuid("Choose a request"),
  targets: targetsField,
  version: z.string().min(1).nullable(),
});

export type GenerateRosterInput = z.infer<typeof generateRosterSchema>;

const versionField = z.string({ error: "The roster version is missing" }).min(1, "The roster version is missing");

export const replaceWorkerSchema = z
  .object({
    rosterId: z.string({ error: "Choose a roster" }).uuid("Choose a roster"),
    lineId: z.string({ error: "Choose a line" }).uuid("Choose a line"),
    fromWorkerId: z.string({ error: "Choose a worker" }).uuid("Choose a worker"),
    toWorkerId: z.string({ error: "Choose a worker" }).uuid("Choose a worker"),
    version: versionField,
  })
  .superRefine((input, ctx) => {
    if (input.fromWorkerId === input.toWorkerId) {
      ctx.addIssue({
        code: "custom",
        path: ["toWorkerId"],
        message: "Choose a different worker",
      });
    }
  });

export type ReplaceWorkerInput = z.infer<typeof replaceWorkerSchema>;

export const confirmRosterSchema = z.object({
  rosterId: z.string({ error: "Choose a roster" }).uuid("Choose a roster"),
  version: versionField,
});

export type ConfirmRosterInput = z.infer<typeof confirmRosterSchema>;

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function uuidOrNull(value: string | string[] | undefined): string | null {
  const first = firstValue(value);

  return z.string().uuid().safeParse(first).success ? first : null;
}

const STATUSES: RosterStatusFilter[] = ["draft", "confirmed", "not-generated"];

// Reads the Roster list filters from the URL. Anything unknown falls back to its default, so a bad
// link shows the whole list instead of an error.
export function parseRosterFilters(params: SearchParams): RosterFilters {
  const status = firstValue(params.status) as RosterStatusFilter;
  const type = firstValue(params.type);

  return {
    status: STATUSES.includes(status) ? status : "all",
    type: type === "daily" || type === "weekly" ? type : "all",
    siteId: uuidOrNull(params.site),
    locationId: uuidOrNull(params.location),
    query: firstValue(params.q).trim().slice(0, MAX_QUERY_LENGTH),
  };
}
