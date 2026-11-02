import { LOCATION_TIMEZONES, type LocationTimezone } from "@/validation/location";

const DATE_FORMATTERS = new Map(
  LOCATION_TIMEZONES.map((timeZone) => [
    timeZone,
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
  ]),
);

// The calendar date in the given zone as YYYY-MM-DD, whatever the server time zone is.
export function dateInZone(timeZone: LocationTimezone, now: Date = new Date()): string {
  const formatter = DATE_FORMATTERS.get(timeZone);

  if (!formatter) {
    throw new Error(`Unsupported time zone: ${timeZone}`);
  }

  return formatter.format(now);
}
