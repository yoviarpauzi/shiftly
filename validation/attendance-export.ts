import { z } from "zod";

import { isCalendarDate } from "./calendar-date";

const locationIdSchema = z.string().uuid();

// Reads the export URL: one location uuid and one real date. A missing, repeated, or malformed
// value gives null, which the route turns into a 404.
export function parseExportParams(
  params: URLSearchParams,
): { locationId: string; date: string } | null {
  const locations = params.getAll("location");
  const dates = params.getAll("date");

  if (locations.length !== 1 || dates.length !== 1) {
    return null;
  }

  const location = locationIdSchema.safeParse(locations[0]);

  if (!location.success || !isCalendarDate(dates[0])) {
    return null;
  }

  return { locationId: location.data, date: dates[0] };
}
